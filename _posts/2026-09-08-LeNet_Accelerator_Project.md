---
layout: single
title: "2026 여름방학 프로젝트: LeNet FPGA 가속기 — Baseline에서 BitMoD v3까지"
categories: Project
tags: FPGA
toc: true
toc_sticky: true
author_profile: false
comments: true
---

<link rel="stylesheet" href="{{ "/assets/css/lenet-project.css" | relative_url }}">

<div class="lenet-project" markdown="1">

MNIST 손글씨 숫자를 분류하는 LeNet을 소프트웨어에서 먼저 검증하고, Zynq의 FPGA 영역으로 옮긴 뒤, 메모리 접근·연산 병렬화·저정밀 표현을 개선한 여름방학 프로젝트를 정리한다. 출발점은 “CNN이 FPGA에서 동작하는가?”였지만, 다음 단계에서는 “왜 느린가?”, “연산기를 늘렸는데 데이터는 충분히 공급되는가?”, “정확도를 유지하면서 표현 비트 수까지 줄일 수 있는가?”로 질문이 이어졌다.

이 글은 프로젝트 개요, LeNet baseline, accelerator v2, BitMoD v3의 네 기록을 하나로 연결한 것이다. 앞에서는 설계 흐름과 결과의 의미를 설명하고, 뒤의 **버전별 전체 기록**에는 원문의 설명·코드·실행 로그·이미지를 모두 수록했다. v3에 연결된 **450행 × 20열 실험표**도 이 글 안에서 확인할 수 있다. 코드와 실행 로그는 언어별 코드 블록으로 표시하며, 원본 이미지는 클릭하면 큰 크기로 열린다.

보충 해설은 제공된 코드·구조도·로그를 바탕으로 작성했다. 특히 v3 압축파일에는 RTL·양자화 스크립트 자체가 들어 있지 않으므로, 그 부분은 구조도에서 확인되는 구성과 실행 로그가 입증하는 결과를 기준으로 설명한다. 측정 조건이 다른 기록을 한 숫자로 합치지 않고 아래에서 구분한다.

## 1. 무엇을 만들었는가?

### 1.1 모델과 연산량부터 고정하기

사용한 모델은 입력이 `1×28×28`인 modified LeNet-1이다. 5×5 convolution 두 번과 2×2 max pooling 두 번을 거친 뒤, 192개 특징으로 숫자 0~9의 점수 10개를 계산한다. 일반적인 LeNet의 다른 변형과 혼동하지 않도록 이 프로젝트의 shape를 먼저 고정한다.

| 단계 | 연산 | 출력 shape | 가중치 수 | 곱셈·누산 수/이미지 |
|---|---|---|---:|---:|
| 입력 | 8-bit grayscale | 1×28×28 | 0 | 0 |
| CONV1 | 5×5, stride 1, padding·bias 없음 | 4×24×24 | 100 | 57,600 |
| ReLU + POOL1 | ReLU, 2×2 max, stride 2 | 4×12×12 | 0 | 비교 연산 |
| CONV2 | 5×5, 입력 4채널, 출력 12채널 | 12×8×8 | 1,200 | 76,800 |
| ReLU + POOL2 | ReLU, 2×2 max, stride 2 | 12×4×4 | 0 | 비교 연산 |
| FC + ReLU | 192 → 10, bias 없음 | 10 | 1,920 | 1,920 |
| Argmax | 가장 큰 점수의 번호 선택 | 0~9 | 0 | 비교 연산 |
| 합계 | | | **3,220** | **136,320 MAC** |

MAC은 multiply-accumulate, 즉 곱한 값을 누산기에 더하는 연산이다. CONV1의 출력 하나는 25개 입력과 가중치를 곱해 더하므로 `4×24×24×25=57,600` MAC이다. CONV2는 출력 하나당 `4×25=100` MAC이 필요하므로 `12×8×8×100=76,800` MAC이다. FC에는 `192×10=1,920` MAC이 필요하다. 이 합은 순수 산술 연산량이며, 실제 cycle에는 메모리 요청·대기·상태 전환·결과 저장이 추가된다.

소프트웨어 baseline은 입력 `uint8`, 가중치 `int8`, CONV와 FC 결과 `int32`를 사용한다. Python에서는 먼저 넓은 정수형으로 계산해 int32 범위에 들어가는지 검사한다. 따라서 중간 activation을 8-bit로 다시 잘라 버리는 모델과 다르다. 뒤의 v3에서 말하는 **1-bit 입력**도 모든 중간 activation이 1-bit라는 뜻은 아니다.

### 1.2 PS와 PL의 역할

Zynq는 ARM 프로세서가 있는 PS(processing system)와 FPGA 회로를 만드는 PL(programmable logic)을 함께 제공한다. PS는 이미지·가중치 준비, 가속기 제어, 결과 수집을 담당하고, PL은 convolution과 FC 등의 계산을 수행한다.

Baseline에서는 PS가 메모리 주소를 읽고 쓰는 MMIO 방식으로 BRAM과 제어 레지스터에 접근한다. v2·v3에서는 AXI DMA가 메모리와 AXI4-Stream 사이의 데이터를 옮긴다. DMA를 쓰더라도 CPU의 버퍼 준비와 캐시 관리, 전송 시작, 완료 확인 비용이 없어지는 것은 아니다. PL 내부 시간과 PS→PL→PS 전체 시간을 따로 재야 하는 이유다.

<div class="lenet-flow" role="group" aria-label="프로젝트의 세 단계">
  <div><strong>Baseline</strong><span>동작 기준 확보</span><p>단일 MAC · 공유 BRAM<br>계층별 순차 실행</p></div>
  <div><strong>Accelerator v2</strong><span>데이터 공급과 병렬화</span><p>전용 엔진 · line buffer<br>ping/pong · DMA</p></div>
  <div><strong>BitMoD v3</strong><span>표현과 시스템 최적화</span><p>저정밀 가중치 · 캐시<br>정확한 rescale · PS 경로 개선</p></div>
</div>

## 2. Baseline: 먼저 믿을 수 있는 기준을 만들기

### 2.1 분류 정확도와 구현 일치는 다른 검사다

Python 기준 결과는 1,000장 중 986장 정답, 즉 98.60%이다. 여기서 14장의 오분류는 모델이 틀린 것이며, FPGA 구현 오류를 뜻하지 않는다. RTL이 Python과 같은 이미지를 똑같이 틀린다면 구현은 모델을 충실히 재현했을 수도 있다. 반대로 정답률이 우연히 같아도 각 이미지의 점수가 다르면 같은 계산을 구현했다고 확정할 수 없다.

따라서 검증은 입력·가중치 정렬, 중간 feature, 10개 출력 점수, 예측 번호, 정답 라벨 순서로 나누어 보는 것이 좋다. 제공된 baseline Python은 중간 결과를 보관하는 옵션과 raw/ReLU logit을 함께 제공하여 이런 대조를 할 수 있게 구성되어 있다.

### 2.2 BRAM을 32-bit word로 정리하는 이유

MNIST 이미지 한 장은 `784×8=6,272 bit`이다. 32-bit word 하나에 8-bit 픽셀 네 개를 묶으면 196 words가 된다. 가중치 3,220개도 같은 방식으로 네 개씩 묶어 805 words에 넣는다. 주소 계산은 이 word 단위와 개별 byte 단위를 구분해야 한다.

예를 들어 가중치의 전체 byte 번호가 $b$라면 word 주소는 $\lfloor b/4\rfloor$, word 안의 byte 번호는 $b\bmod4$이다. byte selector가 해당 8-bit를 꺼낸 뒤 signed 값으로 해석해야 음의 가중치가 올바르게 계산된다. 원문에는 이 배치와 byte selector, BRAM 설정 화면이 모두 들어 있다.

중간 feature는 최대인 CONV1의 `4×24×24=2,304`개를 기준으로 32-bit BRAM을 잡고, 계층별로 주소 구간을 재사용한다. 메모리를 아끼는 단순한 구조지만 CONV→ReLU→Pool마다 데이터를 저장하고 다시 읽는 비용이 생긴다.

### 2.3 병목이 PL에 있다는 것을 측정으로 확인하기

실제 보드 baseline은 50 MHz에서 이미지당 **434,330 cycles**, 순수 PL **8,686.60 μs**이다. 1,000장 E2E는 **8,760.471 ms**이고 그중 PL 계산은 **8,686.600 ms**이다. 따라서 나머지 PS·AXI·제어 비용은 `8,760.471−8,686.600=73.871 ms`, 전체의 약 0.84%이다. 이 상태에서 PS만 아무리 빨라져도 전체 시간의 대부분은 그대로 남는다.

이 결과가 다음 버전의 방향을 정한다. 먼저 MAC 연산을 병렬화하고, 병렬 연산기에 필요한 데이터 공급과 중간 저장 구조를 바꿔야 한다. 그 뒤에 PS와 DMA의 비용이 상대적으로 중요해진다.

Baseline 보드의 정확도는 **984/1,000=98.40%**, Python과 RTL simulation은 **986/1,000=98.60%**로 기록되어 있다. 보드 로그에는 이미지 10·11의 추가 오분류가 보인다. 클록이 50 MHz와 100 MHz로 다르다는 사실만으로 이 정확도 차이를 설명할 수는 없다. 원문은 차이의 원인을 확정하지 않았으므로 이 글도 데이터·타이밍·전송 중 하나를 원인으로 단정하지 않는다.

## 3. Accelerator v2: 연산과 데이터 이동을 함께 바꾸기

### 3.1 연산기를 늘리는 것만으로는 부족하다

v2는 CONV1과 CONV2에 전용 엔진을 두고 ReLU·Pool을 엔진 안으로 통합했다. CONV 결과를 공유 BRAM에 쓴 뒤 별도 ReLU 엔진이 읽고, 다시 Pool 엔진이 읽던 경로를 줄인다. POOL2 결과도 FC에 직접 전달하여 큰 중간 저장을 피한다.

CONV1은 25개의 kernel tap을 동시에 처리하는 dot-product 두 개로 출력 채널 두 개를 병렬 계산한다. 산술 lane 기준으로 50 DSP 구조이며, 네 출력 채널은 두 차례에 나누어 처리한다. CONV2는 출력 채널 네 개를 병렬 계산하면서 입력 채널 네 개는 순서대로 누적하는 100-DSP 구조다. 12개 출력 채널을 세 그룹으로 나누므로 한 공간 위치에서 `3×4=12`번 issue한다. FC는 한 activation을 10개 class lane에 전달한다.

여기서 issue 횟수는 입력을 연산 파이프라인에 넣는 반복 수다. 파이프라인 채우기·배출과 메모리 준비 시간을 포함한 최종 프레임 cycle과 같지는 않다. 또한 모듈 이름의 DSP 수는 설계 의도를 설명하며, 전체 칩의 최종 자원 사용률은 구현 보고서와 함께 판단해야 한다.

### 3.2 Line buffer와 FIFO가 병렬 연산기에 데이터를 공급한다

5×5 window를 오른쪽으로 한 칸 옮기면 25개 중 20개가 이전 window와 겹친다. 매번 25개를 BRAM에서 다시 읽는 대신 이전 행을 line buffer에 보관하고, 필요한 새 픽셀만 받아 window를 갱신한다. 같은 입력을 여러 출력 채널에서 재사용하면 BRAM의 제한된 포트 수로도 많은 연산기에 값을 공급할 수 있다.

Window 생성과 dot-product issue의 속도는 항상 같지 않다. FIFO는 생성한 window를 잠시 보관해 두 작업의 순간적인 속도 차이를 흡수한다. 단, 유한한 FIFO가 느린 소비자를 무한히 따라잡게 만들지는 않는다. 꽉 차면 생산을 멈추고, 비면 소비를 기다리는 흐름 제어가 필요하다. 원문의 `conv1_window_fifo_bmg`와 엔진 제어 코드는 이 관계를 구체적으로 보여 준다.

### 3.3 Ping/pong과 row-ready로 대기를 줄인다

이미지와 Pool1 메모리를 각각 두 bank로 나누면 한쪽을 읽는 동안 다른 쪽을 쓸 수 있다. 이것이 ping/pong buffering이다. 다만 아직 읽는 bank를 다음 프레임이 덮어쓰면 안 되므로, 두 frame slot과 bank 소유 상태를 함께 관리해야 한다.

Pool1 전체가 완성될 때까지 CONV2를 기다리게 할 필요도 없다. CONV2의 다음 window에 필요한 행이 준비되었다면 먼저 시작할 수 있다. v2의 `row_ready`는 해당 행의 채널 데이터가 모두 기록되었는지 표시한다. 같은 프레임에서 계층의 실행을 겹치는 동작과, 다른 프레임이 서로 다른 엔진을 사용하는 동작을 구분하면 제어 구조가 이해된다.

가중치는 최초에 805 words를 읽어 local cache로 옮긴 뒤 재사용한다. 따라서 첫 프레임의 준비 비용과 이후 프레임의 연산 비용이 달라진다. 이것이 cold/steady 구분으로 이어진다.

### 3.4 v2의 결과가 다음 병목을 드러낸다

125 MHz의 v2 steady PL은 **1,504 cycles=12.032 μs**이며, 보드 정확도는 **98.60%**이다. 1,000장 PL 총시간은 12.083536 ms, 가중치 준비와 DMA 등을 포함한 FULL 총시간은 22.589361 ms이다. Non-PL은 10.505825 ms로 전체의 약 46.5%를 차지한다.

Baseline에서는 0.84%였던 호스트·전송 부분의 비중이 이제 거의 절반이 되었다. PL이 빨라졌기 때문에 드러난 병목이다. v3에서는 저정밀 연산뿐 아니라 PS 버퍼 준비와 DMA/cache maintenance 경로도 함께 개선해야 전체 성능이 따라온다.

## 4. BitMoD v3: 왜 입력 1-bit와 가중치 4-bit를 검토했는가?

### 4.1 비트 수를 줄인다는 말의 정확한 의미

8-bit 입력은 픽셀당 256개 값을 구별한다. 입력을 1-bit로 양자화하면 두 상태로만 구별하므로 회색 농도의 세부 정보가 줄어든다. MNIST에서는 글자의 형태가 남아 분류가 유지될 가능성이 있지만, 그것은 실험으로 확인해야 한다. 원본의 입력 비트 비교 이미지를 보면 회색 계조가 줄어드는 모습을 확인할 수 있다.

일반적인 균일 양자화는 실수값 $w$를 다음처럼 정수 code $q$로 옮긴다.

$$
q=\operatorname{clip}\left(\operatorname{round}(w/s)+z,\ q_{\min},q_{\max}\right),
\qquad \hat w=s(q-z).
$$

$s$는 한 단계의 실제 간격인 scale, $z$는 영점의 code인 zero-point다. 반올림은 가까운 표현값을 고르고 clipping은 표현 범위 밖의 값을 끝값으로 제한한다. 대칭 양자화는 보통 0을 중심으로 범위를 정하고, 비대칭 양자화는 데이터의 최소·최대 등에 맞춰 zero-point도 조정한다. 이 식은 원리를 설명하는 것이며, 첨부되지 않은 v3 스크립트의 반올림·포화 규칙을 특정한 것은 아니다.

원본 표의 `Image Bits`는 입력 이미지의 비트 수다. 가중치의 `Weight Bits`와 독립적으로 바꾼다. 중간 activation과 누산기는 별도로 정밀도를 유지할 수 있다. 따라서 “입력 1-bit, 가중치 4-bit”만 보고 전체 네트워크의 모든 곱셈이 1×4-bit라고 계산하면 안 된다.

### 4.2 PT·PC·PG와 그룹 크기를 읽는 법

한 scale을 얼마나 많은 가중치가 공유하는지가 granularity이다. PT(per-tensor)는 텐서 전체, PC(per-channel)는 채널별, PG(per-group)는 더 작은 묶음별로 표현 범위를 맞춘다. 작은 그룹은 서로 다른 분포에 더 잘 맞출 수 있지만 scale·zero-point·형식 선택 정보가 많아지고, 그룹마다 계산한 부분합을 다시 맞추는 비용이 생긴다.

원본의 PG 이름에 적힌 세 숫자는 CONV1·CONV2·FC의 그룹 길이를 나타내는 것으로 결과표의 group 연산 수와 일치한다. 각 출력의 축 길이는 각각 25, 100, 192이며 다음 계산으로 확인할 수 있다.

| Preset | 그룹 길이 C1/C2/FC | 가중치 그룹 수 | 출력별 rescale 횟수를 합한 값 |
|---|---|---:|---:|
| fine | 5 / 10 / 16 | 20+120+120=260 | 2,304×5 + 768×10 + 10×12 = **19,320** |
| kernel | 25 / 25 / 24 | 4+48+80=132 | 2,304×1 + 768×4 + 10×8 = **5,456** |
| coarse | 25 / 50 / 48 | 4+24+40=68 | 2,304×1 + 768×2 + 10×4 = **3,880** |

가중치 그룹 수와 이미지당 rescale 횟수는 다른 양이다. 같은 convolution 가중치 그룹을 여러 공간 위치에서 반복 사용하므로, 저장할 metadata 개수보다 실행할 rescale 횟수가 많다.

### 4.3 같은 4-bit라도 표현값의 배치가 다르다

INT와 FP를 구분해야 한다. 정수형의 값들은 scale을 적용하기 전 일정한 간격을 갖는다. 작은 부동소수점 codebook은 지수와 가수 조합에 따라 값 사이의 간격이 달라지며, 같은 비트 수에서도 표현 가능한 값의 분포가 달라진다. 표의 FP6-E2M3와 FP6-E3M2는 지수와 가수에 배정한 비트 수가 다른 후보이다. 정확한 subnormal·특수값 규칙은 해당 구현 정의가 있어야 확정할 수 있다.

[BitMoD 논문](https://arxiv.org/abs/2411.11745)은 작은 가중치 그룹의 분포에 맞춰 데이터 형식을 선택하고, 여러 형식과 정밀도를 처리하는 bit-serial 연산 및 그룹 부분합의 rescale을 함께 설계한다. 여기서는 그 아이디어를 LeNet에서 탐색한 기록을 다룬다. 논문의 LLM 실험 수치를 이 프로젝트의 결과로 사용하지 않는다.

프로젝트 표의 `BitMoD-FP4-Adaptive-PG`는 그룹 단위 적응형 FP4 후보라는 이름이다. 고정 FP4-PG와 달리 그룹마다 적합한 표현을 고르는 방식으로 해석할 수 있지만, 실제 선택 후보와 오차 목적함수는 양자화 스크립트가 없어 확정할 수 없다. 예를 들어 평균제곱오차를 최소화하는 선택은 가능한 일반 원리이며, 이 프로젝트가 그 목적함수를 사용했다고 단정하지 않는다.

### 4.4 75개 가중치 설정 × 6개 입력 정밀도

첨부된 전체 표는 75개 가중치 설정에 입력 8·6·4·3·2·1-bit를 조합한 **450회 평가**이다. 각 행은 1,000장에 대한 정답 수·정확도·실행시간·저장량·추정 비용을 담고 있다. 1,000장에서는 한 장이 0.1 percentage point(pp)이므로 작은 차이의 의미를 함께 봐야 한다.

Original-INT8 / Image8은 **98.60%**다. 가중치를 그대로 두고 Image1만 적용하면 **98.40%**로 2장 차이다. 반면 INT2-Sym-PT / Image8은 **9.80%**로 크게 떨어진다. 입력의 계조를 줄이는 것과 가중치의 표현값을 줄이는 것은 같은 민감도를 갖지 않는다.

| 비교할 후보 | 입력 bit | 정확도 | Original8 대비 | 가중치 저장량 | 해석 |
|---|---:|---:|---:|---:|---|
| Original-INT8 | 8 | 98.60% | 0.00 pp | 3,220 B | 소프트웨어 양자화 표의 기준 |
| Original-INT8 | 1 | 98.40% | −0.20 pp | 3,220 B | 입력만 이진화한 경우 |
| INT4-Sym-PG-kernel | 4 | 99.00% | +0.40 pp | 전체 표 참조 | 정확도 우선 후보 |
| BitMoD-FP4-Adaptive-PG-fine | 1 | 98.50% | −0.10 pp | 1,935 B | 작은 그룹, metadata·rescale 증가 |
| BitMoD-FP4-Adaptive-PG-kernel | 1 | 98.10% | −0.50 pp | 1,775 B | 원문 요약의 Best BitMoD 후보 |
| BitMoD-FP4-Adaptive-PG-coarse | 1 | 98.00% | −0.60 pp | 1,695 B | 저장량 감소, 정확도 추가 손실 |

이 결과는 “1-bit 입력과 4-bit 가중치를 고려할 근거”를 제공한다. 모든 데이터셋에서 같은 정확도를 보장하거나, 표의 최고 정확도가 일반화 성능의 개선임을 입증하는 것은 아니다. 같은 1,000장으로 후보를 많이 비교했으므로 별도 평가 데이터로 확인할 필요도 있다.

또 하나 구분할 점이 있다. **최종 v3 RTL·보드 로그는 98.30%**인데, 표의 Best BitMoD kernel/Image1 행은 **98.10%**다. 정확도가 다르므로 최종 RTL이 바로 그 행의 설정이라고 연결할 수 없다. 원문에는 최종 cache와 450행의 특정 설정을 대응시키는 설정 파일이 없어서, 탐색 결과와 최종 구현 결과를 각각 제시한다.

### 4.5 저장량과 HW score를 실제 속도로 오해하지 않기

이상적인 입력 bit packing에서 1-bit 이미지 784개 값은 784 bit이다. 32-bit word로 올림하면 $\lceil784/32\rceil=25$ words, 실제 word 용량은 800 bit이다. 그래서 표의 입력 압축비는 $196/25=7.84$배이며 정확히 8배가 아니다.

가중치도 4-bit code만 계산하면 `3,220×4=12,880 bit`지만 그룹 metadata가 추가된다. kernel BitMoD-FP4의 표에서는 14,200 bit이고 byte 올림은 1,775 B이다. 원래 3,220 B와 비교한 압축비는 약 1.814배로, 단순한 8/4=2배보다 작다.

다만 **이 표의 packed 저장량과 최종 외부 전송량은 구분해야 한다.** v3 로그에는 원래 INT8 가중치 805 words를 적재한다고 되어 있고, 구조도도 Weight BRAM `805×32-bit`, Image packet `196×32-bit`를 표시한다. 표의 입력 25 words가 최종 DMA payload로 그대로 구현되었다고 말할 수 없다. 외부에는 기존 표현으로 보내고 PL 내부에서 변환·캐시하는 경로일 수 있으며, 세부 packet 규격은 제공된 자료 범위에서 확정하지 않는다.

`Compute Proxy`, `Group Penalty`, `HW Efficiency Score`는 후보를 비교하기 위한 **추정 지표**다. 450행을 만든 계산 스크립트가 없으므로 정확한 산식을 새로 만들어 붙이지 않는다. 낮은 정확도의 후보가 높은 score를 얻을 수도 있어 먼저 허용 정확도 손실을 정한 뒤 비교해야 한다. 표의 `Elapsed (s)`도 양자화 평가 실행시간으로, FPGA clock cycle을 직접 측정한 값이 아니다.

## 5. v3 구조도와 실행 로그를 함께 읽기

### 5.1 전체 데이터 경로

v3 block design에는 Zynq PS, AXI DMA, SmartConnect, reset 회로, `lenet_axis_wrapper_v3`가 있다. DMA의 MM2S는 메모리에서 읽은 데이터를 PL의 입력 stream으로 보내고, S2MM은 PL 출력 stream을 메모리에 쓴다. AXI-Lite 제어 경로는 DMA에 주소와 길이 등을 설정하는 데 사용한다. 데이터 경로와 제어 경로를 구분하면 복잡한 선들이 무엇을 하는지 이해할 수 있다.

원본 계층도에는 wrapper 아래 `lenet_v3_bitmod`, image/pool ping-pong BMG, 가중치 subsystem, CONV1·CONV2·FC 엔진이 나타난다. wrapper는 packet parser와 frame control, 결과 capture와 serializer를 담당하고, core는 계산과 bank 스케줄링을 담당하는 구조다. 서로 다른 프레임이 섞이지 않도록 frame ID와 상태를 함께 관리한다.

### 5.2 가중치 code와 scale을 함께 계산해야 한다

저정밀 가중치에는 값의 code뿐 아니라 scale이나 형식 metadata가 필요하다. 서로 다른 그룹의 정수 부분합을 그대로 더하면 서로 다른 단위를 더하는 셈이 된다. 예를 들어 두 그룹의 scale이 $s_1,s_2$라면 내적의 구조는

$$
y\approx s_1\sum_{i\in G_1}a_i\tilde q_i
+s_2\sum_{i\in G_2}a_i\tilde q_i,
$$

이며 $\tilde q_i$는 code를 해석하고 필요한 영점 보정을 적용한 값이다. 각 부분합을 같은 출력 단위로 맞춘 뒤 더해야 한다. 구조도의 `bitmod_scale_c1_exact32`, `bitmod_scale_c2_exact48`, `bitmod_scale_fc_mag_exact51` 같은 모듈은 이 scale 및 넓은 중간 계산 경로를 설명하는 단서다. 이름의 숫자를 전체 activation의 공통 저장 폭이라고 해석해서는 안 된다.

Bit-serial 연산의 기본 생각은 정수 $q=\sum_bq_b2^b$에 대해 $aq=\sum_bq_b(a\,2^b)$로 나누는 것이다. 비트 선택과 shift·누산을 이용해 곱을 구성할 수 있다. 부호·FP codebook·scale 처리는 별도로 필요하며, 실제 v3 도식에도 DSP와 mixed 연산 경로가 함께 표시되어 있다. 따라서 모든 DSP가 제거된 순수 shift-add 설계로 설명하지 않는다.

### 5.3 Line buffer 수정과 P2FIX16 경로

구조도는 CONV2 line buffer를 FF 기반의 deterministic fix로 표시한다. line buffer는 window에 들어갈 이전 행의 값을 일정한 시점에 공급해야 한다. 메모리 read 지연이나 충돌 시의 동작이 기대와 다르면 값은 맞아도 한 cycle 어긋난 window가 만들어질 수 있다. FF 기반이라는 표시는 이 경로의 타이밍을 명시적으로 고정하려는 수정으로 읽을 수 있다. 다만 이전 RAM 구현의 구체적인 실패 파형은 제공되지 않아 원인을 더 좁혀 단정하지 않는다.

POOL2의 결과는 192개 feature이며 도식에는 `P2FIX16`, `96 beats×32-bit`로 적혀 있다. 숫자상으로 16-bit feature 두 개를 32-bit beat에 묶어 내보내는 구조와 일치한다. FC가 그 표현을 해석하여 누산과 최종 scale을 수행한다. 소수점 위치, signed 여부, rounding 규칙은 도식에 없으므로 특정 Q-format을 임의로 부여하지 않는다.

### 5.4 Cold와 steady를 나누어 보는 이유

가중치와 내부 cache를 준비하는 비용이 첫 이미지에 포함되면 첫 프레임만 길어진다. 최종 보드 로그에서 cold PL은 **197,254 cycles**, steady PL은 **962 cycles**이다. 160 MHz에서는

$$
t_{\mathrm{steady}}=\frac{962}{160\times10^6}
=6.0125\ \mu\mathrm{s},\qquad
t_{\mathrm{cold}}=\frac{197254}{160\times10^6}
=1232.8375\ \mu\mathrm{s}.
$$

가중치를 공유하는 이미지들을 계속 처리할수록 첫 준비 비용을 여러 이미지에 나누어 부담한다. 단발 추론 성능을 말할 때 cold를 빼면 안 되고, 반복 처리의 내부 속도를 보려면 steady를 따로 봐야 한다.

PL simulation 비교 로그는 약 150 MHz에서 **cold 841,253 / steady 961 cycles**를 기록한다. 최종 보드 로그는 160 MHz에서 **197,254 / 962 cycles**다. 주파수 차이는 시간을 바꾸지만 cycle 수의 차이를 자동으로 설명하지 않는다. 이들은 별도의 실행 기록이며 계측 경계나 버전 차이를 확인할 RTL·설정이 없어 하나로 합치지 않는다.

### 5.5 PASS가 정확히 무엇을 확인했는가?

v3 simulation 로그에는 prediction golden mismatch 0/1,000, exact cache mismatch 0, exact logit mismatch 0, overflow 0이 기록되어 있다. 이는 **해당 테스트에서 참조 모델과 구현 결과가 일치했다는 검사**이다. 정답 라벨 기준으로는 983/1,000이므로 17장은 여전히 분류 오류다. 기능 일치와 모델 정확도가 서로 다른 지표라는 baseline의 구분이 여기에서도 중요하다.

다만 `Exact logit mismatches (10)`의 `(10)`이 10개 class 출력을 뜻하는지, 검사한 이미지 범위까지 나타내는지는 테스트벤치가 없어 확정할 수 없다. 로그의 exact PASS를 기록하되, 전체 1,000장의 모든 중간 비트를 검사했다고 확대하지 않는다. 보드에서는 별도로 가중치 hash 일치, status/frame error 0, 최종 정확도 98.30%가 기록되어 있다.

### 5.6 PS 경로 개선도 전체 성능에 기여한다

최종 PS 로그에는 Simple DMA + Direct MMIO, 미리 만든 TX 버퍼, bulk cache maintenance가 적혀 있다. 매 이미지마다 같은 packet을 다시 만들거나 너무 작은 범위의 cache 관리를 반복하면 PL 밖의 비용이 커진다. TX 준비를 미리 하고 필요한 cache 작업을 묶는 방식은 그 반복 비용을 줄일 수 있다. DMA가 CPU cache와 자동으로 일관성을 보장하지 않는 경로에서는 전송 전 flush와 수신 후 invalidate의 범위·순서를 맞추는 것이 중요하다.

기록상 v3의 steady E2E는 **9.385936 μs**, 그중 PL은 **6.012500 μs**, Non-PL은 **3.373436 μs**다. 내부 회로가 6 μs에 끝나도 사용자가 보는 결과 도착 시간은 전송과 제어를 포함하므로 약 9.39 μs가 된다. 순수 PL의 역수와 실제 E2E 처리량을 별도로 표기해야 한다.

## 6. 성능 비교와 기록의 차이를 해석하기

### 6.1 실제 보드 로그를 기준으로 비교

| 항목 | Baseline | v2 | v3 최종 |
|---|---:|---:|---:|
| 보드 PL clock | 50 MHz | 125 MHz | 160 MHz |
| 정답 수 / 1,000 | 984 | 986 | 983 |
| 정확도 | 98.40% | 98.60% | 98.30% |
| Steady PL cycles | 434,330 | 1,504 | 962 |
| Steady PL 시간 | 8,686.600 μs | 12.032 μs | 6.0125 μs |
| 1,000장 PL 총시간 | 8,686.600 ms | 12.083536 ms | 7.239325 ms |
| 원문 전체시간 | E2E 8,760.471 ms | FULL 22.589361 ms | E2E 10.753990 ms |
| 최초 가중치 업로드 | 별도 0.297 ms | FULL에 포함 | 별도 0.012624 ms |

v2의 FULL은 weight setup/DMA를 포함하고, baseline·v3의 E2E는 최초 가중치 업로드를 별도 표시한다. 위 표는 원문 계측 정의를 보존한 것이므로 세 전체시간을 무조건 같은 구간으로 취급하면 안 된다. v3의 업로드 포함 전체시간은 **10.766614 ms**이다.

v2→v3 steady PL 개선은 cycle 감소와 clock 향상의 두 효과로 나뉜다.

$$
\frac{t_{v2}}{t_{v3}}
=\frac{1504}{962}\frac{160}{125}
\approx1.5634\times1.28
\approx2.0012.
$$

따라서 cycle은 약 36.04% 줄고 주파수는 28% 증가하여 내부 시간은 약 절반이 되었다. 반면 baseline→v3의 E2E 총시간 비는 약 **814.625배**이며, 이 값에는 구조 변경·주파수 변경·표현 변경·호스트 최적화가 모두 들어 있다. 정확도도 기준 모델에 따라 −0.1 pp 또는 −0.3 pp이므로 “동일 연산을 완전히 같은 조건에서 814배 빠르게 만들었다”는 식으로 쓰지 않는다.

### 6.2 서로 다른 baseline 정확도를 구분하기

v3 로그의 `VS TRUE BASELINE`은 실제 보드 baseline 98.40%를 가리킨다. 따라서 v3 98.30%와의 차이는 **−0.10 pp**다. 양자화 탐색 표의 Original8 및 Python/v2 98.60%와 비교하면 차이는 **−0.30 pp**다. 둘 다 계산은 맞지만 참조 대상이 다르다. 비교 문장에는 어떤 기준인지를 함께 적어야 한다.

### 6.3 로그 내부의 합계 검산에서 확인한 차이

최종 v3의 PL 합계는 cold 한 장과 steady 999장을 더하면 정확히 맞는다.

$$
1232.8375+999\times6.0125=7239.325\ \mu\mathrm{s}.
$$

그러나 E2E의 cold/steady 표기를 같은 방식으로 더하면

$$
1236.284800+999\times9.385936
=10612.834864\ \mu\mathrm{s},
$$

이며, 보고된 E2E total `10753.990 μs`보다 **141.155136 μs 작다**. 전체 측정 구간에 프레임별 측정 밖의 비용이 들어갔을 가능성은 있지만, 실제 PS 계측 코드가 없어 확인할 수 없다. 이 차이를 임의의 항목으로 채우거나 로그 숫자를 고치지 않았다. 따라서 전체 처리량은 원문 total에서, steady 처리량은 원문 steady 값에서 각각 읽는다.

원문 `Baseline PL total / Current PL total`에서 계산되는 비는 약 **1199.9185배**다. 원문은 1199.919배로 표시되어 있는데 표시 정밀도 수준의 차이이며 원문 로그는 유지했다. 중요한 것은 cold가 포함된 PL total 비교와 steady PL 비교를 섞지 않는 것이다.

### 6.4 이 프로젝트에서 얻은 설계 관점

첫 단계에서는 정수 표현·주소 배치·계층 순서를 고정하고 소프트웨어와 RTL을 비교했다. 두 번째 단계에서는 연산기를 늘리는 동시에 line buffer, local weight cache, ping/pong, 스트리밍으로 데이터 공급을 바꿨다. 세 번째 단계에서는 입력과 가중치의 표현을 실험하고, 정확한 rescale과 cache 준비 비용, PS의 DMA 경로까지 함께 살폈다.

이 흐름은 **현재 가장 큰 시간을 차지하는 부분을 측정하고, 그 부분을 바꾼 뒤 다시 측정하는 과정**이다. 아래의 전체 기록은 각 단계의 구현과 측정을 다시 확인할 수 있도록 남긴다.

<nav class="lenet-record-nav" aria-label="전체 기록 바로가기">
<a href="#record-overview">프로젝트 설정</a>
<a href="#record-baseline">Baseline 전체</a>
<a href="#record-v2">v2 전체</a>
<a href="#record-v3">v3 전체</a>
<a href="#record-quantization">450개 실험 전체</a>
</nav>


## 7. 프로젝트 설정 전체 기록
{: #record-overview}

<p class="lenet-record-note">원본 개요의 모델 설정 이미지와 세 버전 연결을 보존했다. 아래 링크는 이 통합 글의 해당 기록으로 연결된다.</p>

{% raw %}

<h3 class="lenet-original-heading">2026년 여름방학 인턴 프로젝트</h3>

<h3 class="lenet-original-heading">Setting</h3>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/overview-01.png"><img src="/assets/images/lenet-project-2026/overview-01.png" alt="OVERVIEW 원본 그림 1 · Setting" width="1147" height="664" loading="lazy" decoding="async"></a><figcaption>OVERVIEW 원본 그림 1 · Setting · 클릭하면 원본 크기로 보기</figcaption></figure>

<h3 class="lenet-original-heading">Baseline</h3>

[LeNet baseline](#record-baseline)

<h3 class="lenet-original-heading">Accelerator v2</h3>

[LeNet accelerator v2](#record-v2)

<h3 class="lenet-original-heading">Accelerator v3</h3>

[LeNet BitMoD v3](#record-v3)
{% endraw %}


## 8. Baseline 전체 구현과 검증 기록
{: #record-baseline}

<p class="lenet-record-note">원문의 Python·Verilog·C 코드, 메모리 설정, 엔진별 설명, 보드·시뮬레이션 결과를 보존했다. 원문 FC 가중치 설명의 “10 × 192 = 192개”는 산술 오기로 올바른 값은 1,920개이며, 표와 코드도 1,920개를 사용한다. 원문 반복 제목 “Image BRAM wrapper” 중 실제 역할이 Weight/Feature인 부분은 하위 모듈 이름으로 구분해서 읽는다.</p>

{% raw %}

<h3 class="lenet-original-heading">LeNet baseline</h3>

<h3 class="lenet-original-heading">Python based</h3>

- Python code



```python
"""
LeNet-1 (modified) software baseline for the SoC project.

PDF model:
  INPUT : 1 x 28 x 28, uint8
  CONV1 : 4 filters, 5 x 5, stride 1, no padding, no bias
  ReLU
  POOL1 : 2 x 2 max pooling, stride 2
  CONV2 : 12 filters, 5 x 5, stride 1, no padding, no bias
  ReLU
  POOL2 : 2 x 2 max pooling, stride 2
  FC    : 192 -> 10, no bias
  ReLU
  Argmax

No activation quantization is performed in this baseline.
Inputs are uint8, provided weight files are int8_t, and CONV/FC outputs
are represented as signed int32 after an explicit range check.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import numpy as np

# -----------------------------------------------------------------------------
# 1. Paths and model constants
# -----------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

INPUT_H = 28
INPUT_W = 28

CONV1_OUT_CHANNELS = 4
CONV1_IN_CHANNELS = 1
CONV1_KERNEL = 5

CONV2_OUT_CHANNELS = 12
CONV2_IN_CHANNELS = 4
CONV2_KERNEL = 5

POOL_KERNEL = 2
POOL_STRIDE = 2

FC_IN_FEATURES = 12 * 4 * 4
FC_OUT_FEATURES = 10

INT32_MIN = np.iinfo(np.int32).min
INT32_MAX = np.iinfo(np.int32).max

# -----------------------------------------------------------------------------
# 2. C-header parsing
# -----------------------------------------------------------------------------

def _extract_c_array_tokens(path: Path) -> list[str]:
    """Extract decimal or hexadecimal integer tokens from the first C array."""
    if not path.exists():
        raise FileNotFoundError(f"Header file not found: {path}")

    text = path.read_text(encoding="utf-8")
    if "{" not in text or "}" not in text:
        raise ValueError(f"No C array initializer found in: {path}")

    body = text.split("{", 1)[1].split("}", 1)[0]
    return re.findall(r"-?0[xX][0-9A-Fa-f]+|-?\d+", body)

def _token_to_int(token: str) -> int:
    sign = -1 if token.startswith("-") else 1
    unsigned = token[1:] if sign < 0 else token

    if unsigned.lower().startswith("0x"):
        return sign * int(unsigned, 16)
    return sign * int(unsigned, 10)

def parse_int8_header(path: Path) -> np.ndarray:
    """Read a C header containing signed int8_t values."""
    values = np.array(
        [_token_to_int(token) for token in _extract_c_array_tokens(path)],
        dtype=np.int64,
    )

    if values.size == 0:
        raise ValueError(f"No values found in: {path}")
    if np.any(values < -128) or np.any(values > 127):
        raise ValueError(f"Value outside int8 range in: {path}")

    return values.astype(np.int8)

def parse_uint8_header(path: Path) -> np.ndarray:
    """Read a C header containing unsigned uint8_t values."""
    values = np.array(
        [_token_to_int(token) for token in _extract_c_array_tokens(path)],
        dtype=np.int64,
    )

    if values.size == 0:
        raise ValueError(f"No values found in: {path}")
    if np.any(values < 0) or np.any(values > 255):
        raise ValueError(f"Value outside uint8 range in: {path}")

    return values.astype(np.uint8)

def require_size(name: str, array: np.ndarray, expected: int) -> None:
    if array.size != expected:
        raise ValueError(
            f"{name} size mismatch: expected {expected}, got {array.size}"
        )

# -----------------------------------------------------------------------------
# 3. Load professor-provided weights and test data
# -----------------------------------------------------------------------------

conv1_flat = parse_int8_header(BASE_DIR / "conv1_arr.h")
conv2_flat = parse_int8_header(BASE_DIR / "conv2_arr.h")
fc1_flat = parse_int8_header(BASE_DIR / "fc1_arr.h")

require_size(
    "CONV1 weights",
    conv1_flat,
    CONV1_OUT_CHANNELS * CONV1_IN_CHANNELS * CONV1_KERNEL * CONV1_KERNEL,
)
require_size(
    "CONV2 weights",
    conv2_flat,
    CONV2_OUT_CHANNELS * CONV2_IN_CHANNELS * CONV2_KERNEL * CONV2_KERNEL,
)
require_size(
    "FC weights",
    fc1_flat,
    FC_OUT_FEATURES * FC_IN_FEATURES,
)

conv1_w = conv1_flat.reshape(
    CONV1_OUT_CHANNELS,
    CONV1_IN_CHANNELS,
    CONV1_KERNEL,
    CONV1_KERNEL,
)
conv2_w = conv2_flat.reshape(
    CONV2_OUT_CHANNELS,
    CONV2_IN_CHANNELS,
    CONV2_KERNEL,
    CONV2_KERNEL,
)
fc1_w = fc1_flat.reshape(FC_OUT_FEATURES, FC_IN_FEATURES)

images_flat = parse_uint8_header(BASE_DIR / "test_images_arr.h")
labels = parse_uint8_header(BASE_DIR / "test_labels_arr.h")

pixels_per_image = INPUT_H * INPUT_W
if images_flat.size % pixels_per_image != 0:
    raise ValueError(
        "Image array size is not divisible by 28*28: "
        f"got {images_flat.size} values"
    )

num_images = images_flat.size // pixels_per_image
if labels.size != num_images:
    raise ValueError(
        f"Image/label count mismatch: images={num_images}, labels={labels.size}"
    )

images = images_flat.reshape(num_images, INPUT_H, INPUT_W)

# -----------------------------------------------------------------------------
# 4. Layer implementations
# -----------------------------------------------------------------------------

def relu(x: np.ndarray) -> np.ndarray:
    """Element-wise ReLU while preserving the input dtype."""
    return np.maximum(x, 0).astype(x.dtype, copy=False)

def _checked_int32_scalar(value: int, context: str) -> np.int32:
    """Verify that an exact integer result can be represented by int32."""
    if value < INT32_MIN or value > INT32_MAX:
        raise OverflowError(f"int32 overflow in {context}: {value}")
    return np.int32(value)

def conv2d(x: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """
    Valid 2-D convolution/cross-correlation used by the provided model.

    x      : (C_in, H, W), uint8 or int32
    weight : (C_out, C_in, KH, KW), int8
    return : (C_out, H-KH+1, W-KW+1), int32

    Stride=1, no padding, no bias.
    """
    if x.ndim != 3 or weight.ndim != 4:
        raise ValueError("conv2d expects x=(C,H,W), weight=(OC,IC,KH,KW)")

    c_in, in_h, in_w = x.shape
    c_out, weight_c_in, kernel_h, kernel_w = weight.shape

    if c_in != weight_c_in:
        raise ValueError(
            f"Input-channel mismatch: x has {c_in}, weight expects {weight_c_in}"
        )

    out_h = in_h - kernel_h + 1
    out_w = in_w - kernel_w + 1
    if out_h <= 0 or out_w <= 0:
        raise ValueError("Kernel is larger than the input feature map")

    output = np.zeros((c_out, out_h, out_w), dtype=np.int32)

    # int64 is used only to detect an overflow before storing the exact result
    # as int32. No scaling, clipping, or activation quantization is performed.
    x64 = x.astype(np.int64, copy=False)
    weight64 = weight.astype(np.int64, copy=False)

    for out_ch in range(c_out):
        for out_row in range(out_h):
            for out_col in range(out_w):
                patch = x64[
                    :,
                    out_row : out_row + kernel_h,
                    out_col : out_col + kernel_w,
                ]
                accumulator = int(
                    np.sum(patch * weight64[out_ch], dtype=np.int64)
                )
                output[out_ch, out_row, out_col] = _checked_int32_scalar(
                    accumulator,
                    f"CONV oc={out_ch}, row={out_row}, col={out_col}",
                )

    return output

def maxpool2d(
    x: np.ndarray,
    kernel: int = POOL_KERNEL,
    stride: int = POOL_STRIDE,
) -> np.ndarray:
    """Channel-wise max pooling."""
    if x.ndim != 3:
        raise ValueError("maxpool2d expects x=(C,H,W)")

    channels, in_h, in_w = x.shape
    out_h = (in_h - kernel) // stride + 1
    out_w = (in_w - kernel) // stride + 1

    output = np.empty((channels, out_h, out_w), dtype=x.dtype)

    for out_row in range(out_h):
        for out_col in range(out_w):
            window = x[
                :,
                out_row * stride : out_row * stride + kernel,
                out_col * stride : out_col * stride + kernel,
            ]
            output[:, out_row, out_col] = window.reshape(channels, -1).max(
                axis=1
            )

    return output

def fully_connected(x: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """
    Fully connected layer without bias.

    x      : (192,), int32
    weight : (10, 192), int8
    return : (10,), int32
    """
    if x.ndim != 1 or weight.ndim != 2:
        raise ValueError("fully_connected expects x=(N,), weight=(M,N)")
    if weight.shape[1] != x.size:
        raise ValueError(
            f"FC size mismatch: x={x.size}, weight input={weight.shape[1]}"
        )

    x64 = x.astype(np.int64, copy=False)
    weight64 = weight.astype(np.int64, copy=False)
    accumulator64 = np.sum(weight64 * x64[np.newaxis, :], axis=1, dtype=np.int64)

    if np.any(accumulator64 < INT32_MIN) or np.any(accumulator64 > INT32_MAX):
        raise OverflowError(f"int32 overflow in FC: {accumulator64.tolist()}")

    return accumulator64.astype(np.int32)

# -----------------------------------------------------------------------------
# 5. Inference result and single-image inference
# -----------------------------------------------------------------------------

@dataclass(frozen=True)
class InferenceResult:
    raw_logits: np.ndarray
    activated_logits: np.ndarray
    prediction: int
    intermediates: Optional[Dict[str, np.ndarray]] = None

def infer(
    image: np.ndarray,
    capture_intermediates: bool = False,
) -> InferenceResult:
    """
    Run one image through the PDF-defined LeNet model.

    Returns both raw FC outputs and ReLU-applied outputs so that later
    PS/PL verification can compare the exact ten output values.
    """
    if image.shape != (INPUT_H, INPUT_W):
        raise ValueError(
            f"Expected image shape {(INPUT_H, INPUT_W)}, got {image.shape}"
        )

    input_tensor = image.astype(np.uint8, copy=False)[np.newaxis, :, :]

    conv1_raw = conv2d(input_tensor, conv1_w)
    conv1_relu = relu(conv1_raw)
    pool1 = maxpool2d(conv1_relu)

    if conv1_raw.shape != (4, 24, 24):
        raise RuntimeError(f"Unexpected CONV1 shape: {conv1_raw.shape}")
    if pool1.shape != (4, 12, 12):
        raise RuntimeError(f"Unexpected POOL1 shape: {pool1.shape}")

    conv2_raw = conv2d(pool1, conv2_w)
    conv2_relu = relu(conv2_raw)
    pool2 = maxpool2d(conv2_relu)

    if conv2_raw.shape != (12, 8, 8):
        raise RuntimeError(f"Unexpected CONV2 shape: {conv2_raw.shape}")
    if pool2.shape != (12, 4, 4):
        raise RuntimeError(f"Unexpected POOL2 shape: {pool2.shape}")

    flattened = pool2.reshape(-1, order="C")
    if flattened.size != FC_IN_FEATURES:
        raise RuntimeError(f"Unexpected flatten size: {flattened.size}")

    raw_logits = fully_connected(flattened, fc1_w)
    activated_logits = relu(raw_logits)
    prediction = int(np.argmax(activated_logits))

    intermediates: Optional[Dict[str, np.ndarray]] = None
    if capture_intermediates:
        intermediates = {
            "input": input_tensor.copy(),
            "conv1_raw": conv1_raw.copy(),
            "conv1_relu": conv1_relu.copy(),
            "pool1": pool1.copy(),
            "conv2_raw": conv2_raw.copy(),
            "conv2_relu": conv2_relu.copy(),
            "pool2": pool2.copy(),
            "flatten": flattened.copy(),
            "fc_raw": raw_logits.copy(),
            "fc_relu": activated_logits.copy(),
        }

    return InferenceResult(
        raw_logits=raw_logits,
        activated_logits=activated_logits,
        prediction=prediction,
        intermediates=intermediates,
    )

# -----------------------------------------------------------------------------
# 6. Dataset evaluation
# -----------------------------------------------------------------------------

def evaluate() -> None:
    print(f"conv1_w : {conv1_w.shape}  dtype={conv1_w.dtype}")
    print(f"conv2_w : {conv2_w.shape}  dtype={conv2_w.dtype}")
    print(f"fc1_w   : {fc1_w.shape}   dtype={fc1_w.dtype}")
    print(f"images  : {images.shape}  dtype={images.dtype}")
    print(f"labels  : {labels.shape}  dtype={labels.dtype}")
    print("activation quantization: disabled")
    print()

    correct = 0
    mismatch_indices: list[int] = []
    start = time.perf_counter()
    report_interval = max(1, num_images // 10)

    for index, (image, label) in enumerate(zip(images, labels)):
        result = infer(image)
        expected = int(label)

        if result.prediction == expected:
            correct += 1
        else:
            mismatch_indices.append(index)

        processed = index + 1
        if processed % report_interval == 0 or processed == num_images:
            elapsed = time.perf_counter() - start
            print(
                f"[{processed:4d}/{num_images}] "
                f"acc={correct / processed * 100:6.2f}%  "
                f"elapsed={elapsed:7.2f}s  "
                f"avg={elapsed / processed * 1000:7.3f}ms/img"
            )

    total = time.perf_counter() - start
    accuracy = correct / num_images * 100.0

    print()
    print("=== Final Result ===")
    print(f"Accuracy       : {correct}/{num_images} = {accuracy:.2f}%")
    print(f"Misclassified  : {len(mismatch_indices)}")
    print(f"Mismatch index : {mismatch_indices}")
    print(f"Total          : {total:.3f} s")
    print(f"Average/image  : {total / num_images * 1000:.3f} ms")

if __name__ == "__main__":
    evaluate()

```




<h4 class="lenet-original-heading">Result</h4>



```bash
conv1_w : (4, 1, 5, 5)  dtype=int8
conv2_w : (12, 4, 5, 5)  dtype=int8
fc1_w   : (10, 192)   dtype=int8
images  : (1000, 28, 28)  dtype=uint8
labels  : (1000,)  dtype=uint8
activation quantization: disabled

[ 100/1000] acc= 96.00%  elapsed=   1.22s  avg= 12.215ms/img
[ 200/1000] acc= 97.00%  elapsed=   2.37s  avg= 11.845ms/img
[ 300/1000] acc= 96.67%  elapsed=   3.50s  avg= 11.679ms/img
[ 400/1000] acc= 97.25%  elapsed=   4.65s  avg= 11.625ms/img
[ 500/1000] acc= 97.80%  elapsed=   5.78s  avg= 11.566ms/img
[ 600/1000] acc= 97.67%  elapsed=   7.04s  avg= 11.728ms/img
[ 700/1000] acc= 98.00%  elapsed=   8.31s  avg= 11.870ms/img
[ 800/1000] acc= 98.25%  elapsed=   9.52s  avg= 11.898ms/img
[ 900/1000] acc= 98.44%  elapsed=  10.73s  avg= 11.920ms/img
[1000/1000] acc= 98.60%  elapsed=  11.94s  avg= 11.945ms/img

=== Final Result ===
Accuracy       : 986/1000 = 98.60%
Misclassified  : 14
Mismatch index : [20, 59, 61, 94, 110, 128, 246, 273, 278, 287, 316, 508, 520, 527]
Total          : 11.945 s
Average/image  : 11.945 ms
```



<h3 class="lenet-original-heading">PL 영역</h3>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-01.png"><img src="/assets/images/lenet-project-2026/baseline-01.png" alt="BASELINE 원본 그림 1 · PL 영역" width="2031" height="1225" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 1 · PL 영역 · 클릭하면 원본 크기로 보기</figcaption></figure>

기본 구조이다.

<h4 class="lenet-original-heading">Image BRAM wrapper</h4>

<h5 class="lenet-original-heading">u_image_bram.v</h5>



```verilog
`timescale 1ns/1ps

// ================================================================
// Image BRAM Wrapper
//
// Port A : Testbench / PS write
// Port B : CONV1 engine read
//
// BMG setting:
// - Component Name   : image_bram_ip
// - Memory Type      : Simple Dual Port RAM
// - Width            : 32 bits
// - Depth            : 196
// - Read Latency B   : 1 clock
// - Output Registers : Disabled
// ================================================================

module image_bram_wrapper (
    input  wire        clk,
    input  wire        ext_we,
    input  wire [7:0]  ext_waddr,
    input  wire [31:0] ext_wdata,
    input  wire [7:0]  int_raddr,
    output wire [31:0] int_rdata
);

    image_bram_ip u_image_bram_ip (
        // Port A: external write
        .clka  (clk),
        .ena   (ext_we),
        .wea   (ext_we),
        .addra (ext_waddr),
        .dina  (ext_wdata),

        // Port B: accelerator read
        // Disable while Port A is loading an image.
        .clkb  (clk),
        .enb   (~ext_we),
        .addrb (int_raddr),
        .doutb (int_rdata)
    );
    
endmodule
```



Port A는 write Port B는 read

<h5 class="lenet-original-heading">Image BRAM setting</h5>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-02.png"><img src="/assets/images/lenet-project-2026/baseline-02.png" alt="BASELINE 원본 그림 2 · Image BRAM setting" width="1291" height="925" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 2 · Image BRAM setting · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-03.png"><img src="/assets/images/lenet-project-2026/baseline-03.png" alt="BASELINE 원본 그림 3 · Image BRAM setting" width="1043" height="788" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 3 · Image BRAM setting · 클릭하면 원본 크기로 보기</figcaption></figure>

Primitives Output Register 체크 해제 중요!


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-04.png"><img src="/assets/images/lenet-project-2026/baseline-04.png" alt="BASELINE 원본 그림 4 · Image BRAM setting" width="1036" height="778" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 4 · Image BRAM setting · 클릭하면 원본 크기로 보기</figcaption></figure>

MNIST 이미지는 28 × 28 = 784 pixels이고, 픽셀 1개 = 8bit로 이루어짐.

BRAM이 32bit width니까 32bit ÷ 8bit = 4 pixels/word

784 pixels ÷ 4 pixels/word = 196 words

이미지 하나에 Image BRAM = 196 words × 32bit = 6,272bit = 784byte

<h4 class="lenet-original-heading">Image BRAM wrapper</h4>

<h5 class="lenet-original-heading">u_weight_bram</h5>



```verilog
`timescale 1ns/1ps

// ================================================================
// Weight BRAM Wrapper
//
// Port A : Testbench / PS write
// Port B : CONV / FC engine read
//
// BMG setting:
// - Component Name   : weight_bram_ip
// - Memory Type      : Simple Dual Port RAM
// - Width            : 32 bits
// - Depth            : 805
// - Read Latency B   : 1 clock
// - Output Registers : Disabled
// ================================================================

module weight_bram_wrapper (
    input  wire        clk,
    input  wire        ext_we,
    input  wire [9:0]  ext_waddr,
    input  wire [31:0] ext_wdata,
    input  wire [9:0]  int_raddr,
    output wire [31:0] int_rdata
);

    weight_bram_ip u_weight_bram_ip (
        // Port A: external write
        .clka  (clk),
        .ena   (ext_we),
        .wea   (ext_we),
        .addra (ext_waddr),
        .dina  (ext_wdata),

        // Port B: accelerator read
        .clkb  (clk),
        .enb   (~ext_we),
        .addrb (int_raddr),
        .doutb (int_rdata)
    );

endmodule
```



<h5 class="lenet-original-heading">Weight Bram setting</h5>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-05.png"><img src="/assets/images/lenet-project-2026/baseline-05.png" alt="BASELINE 원본 그림 5 · Weight Bram setting" width="1292" height="924" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 5 · Weight Bram setting · 클릭하면 원본 크기로 보기</figcaption></figure>

Primitives Output Register 체크 해제 중요!


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-06.png"><img src="/assets/images/lenet-project-2026/baseline-06.png" alt="BASELINE 원본 그림 6 · Weight Bram setting" width="1041" height="788" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 6 · Weight Bram setting · 클릭하면 원본 크기로 보기</figcaption></figure>

Weight BRAM에는 CONV1, CONV2, FC Layer에서 사용하는 모든 가중치가 저장됨.

가중치 하나의 데이터 타입은 signed int 8 이므로, 가중치 1개는 8bit를 차지함. 현재 BRAM의 데이터 폭은 32bit이므로 하나의 BRAM word에 8bit 가중치 4개를 묶어서 저장함.

- Weight 1개: 8bit
- BRAM word 1개: 32bit
- Word당 저장 가능한 Weight 수: 4개

<h5 class="lenet-original-heading">Layer별 Weight 개수</h5>

<h6 class="lenet-original-heading">CONV1 Weight</h6>

CONV1은 입력 채널 1개, 출력 채널 4개, 5×5 크기의 kernel을 사용함.

4 × 1 × 5 × 5 = 100개

따라서 CONV1에는 총 100개의 Weight가 필요함.

<h6 class="lenet-original-heading">CONV2 Weight</h6>

CONV2는 입력 채널 4개, 출력 채널 12개, 5×5 크기의 kernel을 사용함.

12 × 4 × 5 × 5 = 1200개

따라서 CONV2에는 총 1200개의 Weight가 필요함.

<h6 class="lenet-original-heading">FC Weight</h6>

POOL2의 출력 크기는 다음과 같음.

12 × 4 × 4 = 192개

FC Layer는 192개의 입력 feature를 10개의 출력 class에 연결함.

10 × 192 = 192개

따라서 FC Layer에는 총 1,920개의 Weight가 필요함.

<h6 class="lenet-original-heading">전체 Weight 개수</h6>

| Layer | Weight 개수 |
| --- | --- |
| CONV1 | 100 |
| CONV2 | 1,200 |
| FC | 1,920 |
| 합계 | 3,220 |

Weight 하나는 8bit이므로 전체 데이터 크기는 다음과 같음.

3,220 × 8bit = 25,760bit = 3,220byte

하나의 32bit word에는 Weight 4개가 저장되므로 필요한 word 수는 다음과 같음.

3,220 ÷ 4 = 805 words

따라서 Weight BRAM의 크기는

Weight BRAM = 805 words × 32bit

<h6 class="lenet-original-heading">Weight BRAM 내부 배치</h6>

| Byte 범위 | 저장 데이터 | Weight 개수 |
| --- | --- | --- |
| 0 ~ 99 | CONV1 Weight | 100 |
| 100 ~ 1299 | CONV2 Weight | 1,200 |
| 1300 ~ 3219 | FC Weight | 1,920 |

Weight BRAM은 inference를 시작하기 전에 한 번만 적재되며, 여러 이미지를 처리하는 동안 동일한 Weight가 계속 유지됨.

<h4 class="lenet-original-heading">Image BRAM wrapper</h4>

<h5 class="lenet-original-heading">u_feature_map_bram_wrapper</h5>



```verilog
`timescale 1ns/1ps

// ================================================================
// Feature Map BRAM Wrapper
//
// Port A : Accelerator write
// Port B : Accelerator read
//
// BMG setting:
// - Component Name   : feature_map_bram_ip
// - Memory Type      : Simple Dual Port RAM
// - Width            : 32 bits
// - Depth            : 2304
// - Read Latency B   : 1 clock
// - Output Registers : Disabled
// ================================================================

module feature_map_bram_wrapper (
    input  wire         clk,

    input  wire         int_we,
    input  wire [11:0]  int_waddr,
    input  wire [31:0]  int_wdata,

    input  wire [11:0]  int_raddr,
    output wire [31:0]  int_rdata
);

    feature_map_bram_ip u_feature_map_bram_ip (
        // Port A: accelerator write
        .clka  (clk),
        .ena   (int_we),
        .wea   (int_we),
        .addra (int_waddr),
        .dina  (int_wdata),

        // Port B: accelerator read
        // Disable read while writing.
        .clkb  (clk),
        .enb   (~int_we),
        .addrb (int_raddr),
        .doutb (int_rdata)
    );

endmodule
```



<h5 class="lenet-original-heading">Feature Map Bram setting</h5>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-07.png"><img src="/assets/images/lenet-project-2026/baseline-07.png" alt="BASELINE 원본 그림 7 · Feature Map Bram setting" width="1296" height="926" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 7 · Feature Map Bram setting · 클릭하면 원본 크기로 보기</figcaption></figure>

Primitives Output Register 체크 해제 중요!


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-08.png"><img src="/assets/images/lenet-project-2026/baseline-08.png" alt="BASELINE 원본 그림 8 · Feature Map Bram setting" width="1041" height="777" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 8 · Feature Map Bram setting · 클릭하면 원본 크기로 보기</figcaption></figure>

Feature Map BRAM은 각 Layer에서 생성되는 중간 activation 결과를 저장하는 scratchpad memory로 사용됨.

입력 이미지와 Weight는 8bit이지만, convolution 연산에서는 여러 곱셈 결과가 누적되어 중간 결과의 값 범위가 커짐. 따라서 Feature Map은 별도의 activation quantization 없이 signed int32 형식으로 저장함.

- Feature Map 값 1개: 32bit
- BRAM word 1개: 32bit
- Word당 저장되는 Feature Map 값: 1개

즉, Feature Map BRAM에서는 별도의 packing 없이 32bit word 하나에 activation 값 하나를 저장함.

<h5 class="lenet-original-heading">Layer별 Feature Map 크기</h5>

<h6 class="lenet-original-heading">CONV1 출력</h6>

입력 이미지 크기는 28 × 28이며, CONV1은 5 × 5 kernel, stride 1, padding 0을 사용함.

출력의 높이와 너비는 다음과 같음.

28 - 5 + 1 = 24

출력 채널은 4개이므로 전체 activation 개수는 다음과 같음.

4 × 24 × 24 = 2,304개

<h6 class="lenet-original-heading">POOL1 출력</h6>

POOL1은 2 × 2 Max Pooling, stride 2를 사용함.

4 × 12 × 12 = 576개

<h6 class="lenet-original-heading">CONV2 출력</h6>

CONV2 출력은 12개의 채널과 8 × 8 크기로 구성됨.

12 × 8 × 8 = 768개

<h6 class="lenet-original-heading">POOL2 출력</h6>

POOL2 출력은 12개의 채널과 4 × 4 크기로 구성됨.

12 × 4 × 4 = 192개

<h6 class="lenet-original-heading">Layer별 출력 크기 비교</h6>

| Layer | 출력 형태 | Activation 개수 |
| --- | --- | --- |
| CONV1 | 4 × 24 × 24 | 2,304 |
| POOL1 | 4 × 12 × 12 | 576 |
| CONV2 | 12 × 8 × 8 | 768 |
| POOL2 | 12 × 4 × 4 | 192 |

중간 Feature Map 중 가장 큰 것은 CONV1 출력(2,304개)임.

Feature Map 값 하나가 32bit이므로 필요한 BRAM 크기는 다음과 같음.

2,304 × 32bit = 73,728bit = 9,216byte

따라서 Feature Map BRAM의 크기는 다음과 같이 결정됨.

Feature Map BRAM = 2,304 words × 32bit

<h5 class="lenet-original-heading">Feature Map BRAM 주소 재사용</h5>

각 Layer마다 별도의 BRAM을 생성하지 않고, 하나의 Feature Map BRAM을 여러 Layer가 순차적으로 재사용함.

| 주소 범위 | 저장 데이터 |
| --- | --- |
| 0 ~ 2303 | CONV1 출력 |
| 0 ~ 2303 | RELU1 결과를 같은 주소에 덮어쓰기 |
| 0 ~ 575 | POOL1 출력 |
| 576 ~ 1343 | CONV2 출력 |
| 576 ~ 1343 | RELU2 결과를 같은 주소에 덮어쓰기 |
| 576 ~ 767 | POOL2 출력 |
| 576 ~ 767 | FC 입력으로 사용 |

<h6 class="lenet-original-heading">Layer별 메모리 사용 흐름</h6>

1. CONV1은 결과 2,304개를 Feature Map BRAM의 주소 `0 ~ 2303`에 저장함.
2. RELU1은 주소 `0 ~ 2303`을 읽고, ReLU 결과를 같은 주소에 다시 저장함.
3. POOL1은 RELU1 결과를 읽고, 출력 576개를 주소 `0 ~ 575`에 저장함.
4. CONV2는 POOL1 결과를 읽고, 출력 768개를 주소 `576 ~ 1343`에 저장함.
5. RELU2는 주소 `576 ~ 1343`을 읽고, 결과를 같은 주소에 다시 저장함.
6. POOL2는 RELU2 결과를 읽고, 출력 192개를 주소 `576 ~ 767`에 저장함.
7. FC Layer는 주소 `576 ~ 767`에 저장된 192개의 값을 입력으로 사용함.

<h4 class="lenet-original-heading">Verilog Header</h4>

<h5 class="lenet-original-heading">lenet_params.vh</h5>



```verilog
`ifndef LENET_PARAMS_VH
`define LENET_PARAMS_VH

// -----------------------------------------------------------------------------
// PDF-baseline LeNet dimensions
// Input : 1x28x28 uint8
// Conv1 : 4x5x5 -> 4x24x24
// Pool1 : 2x2/2 -> 4x12x12
// Conv2 : 12x4x5x5 -> 12x8x8
// Pool2 : 2x2/2 -> 12x4x4
// FC    : 192 -> 10
// No bias, no padding, no activation quantization.
// -----------------------------------------------------------------------------

`define IMAGE_WORDS          196   // 784 bytes, four pixels per 32-bit word
`define WEIGHT_WORDS         805   // 3220 bytes, four weights per 32-bit word
`define FMAP_WORDS           2304  // largest feature map: 4x24x24 int32

`define CONV1_WEIGHT_BYTE_BASE 0
`define CONV2_WEIGHT_BYTE_BASE 100
`define FC_WEIGHT_BYTE_BASE    1300

`define CONV1_OUT_BASE       0
`define POOL1_OUT_BASE       0
`define CONV2_OUT_BASE       576
`define POOL2_OUT_BASE       576

`define CONV1_OUT_COUNT      2304
`define POOL1_OUT_COUNT      576
`define CONV2_OUT_COUNT      768
`define POOL2_OUT_COUNT      192

`define FC_OUTPUTS           10

`endif
```



기본적인 parameter가 들어가 있음.

<h4 class="lenet-original-heading">LeNet controller</h4>

<h5 class="lenet-original-heading">lenet_controller.v</h5>



```verilog
`timescale 1ns/1ps

// Layer-level controller. All start outputs are one-clock pulses generated
// combinationally from dedicated START states.
module lenet_controller (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       start,

    input  wire       conv_done,
    input  wire       relu_done,
    input  wire       pool_done,
    input  wire       fc_done,
    input  wire       relu10_done,

    output wire       conv_start,
    output wire       conv_layer,
    output wire       relu_start,
    output wire       relu_layer,
    output wire       pool_start,
    output wire       pool_layer,
    output wire       fc_start,
    output wire       relu10_start,

    output wire       busy,
    output wire       done,
    output wire [4:0] debug_state
);
    localparam ST_IDLE       = 5'd0;
    localparam ST_C1_START   = 5'd1;
    localparam ST_C1_WAIT    = 5'd2;
    localparam ST_R1_START   = 5'd3;
    localparam ST_R1_WAIT    = 5'd4;
    localparam ST_P1_START   = 5'd5;
    localparam ST_P1_WAIT    = 5'd6;
    localparam ST_C2_START   = 5'd7;
    localparam ST_C2_WAIT    = 5'd8;
    localparam ST_R2_START   = 5'd9;
    localparam ST_R2_WAIT    = 5'd10;
    localparam ST_P2_START   = 5'd11;
    localparam ST_P2_WAIT    = 5'd12;
    localparam ST_FC_START   = 5'd13;
    localparam ST_FC_WAIT    = 5'd14;
    localparam ST_R3_START   = 5'd15;
    localparam ST_R3_WAIT    = 5'd16;
    localparam ST_DONE       = 5'd17;

    reg [4:0] state;

    assign conv_start = (state == ST_C1_START) || (state == ST_C2_START);
    assign conv_layer = (state == ST_C2_START) || (state == ST_C2_WAIT);

    assign relu_start = (state == ST_R1_START) || (state == ST_R2_START);
    assign relu_layer = (state == ST_R2_START) || (state == ST_R2_WAIT);

    assign pool_start = (state == ST_P1_START) || (state == ST_P2_START);
    assign pool_layer = (state == ST_P2_START) || (state == ST_P2_WAIT);

    assign fc_start = (state == ST_FC_START);
    assign relu10_start = (state == ST_R3_START);

    assign busy = (state != ST_IDLE) && (state != ST_DONE);
    assign done = (state == ST_DONE);
    assign debug_state = state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= ST_IDLE;
        end else begin
            case (state)
                ST_IDLE:     if (start)       state <= ST_C1_START;
                ST_C1_START:                  state <= ST_C1_WAIT;
                ST_C1_WAIT:  if (conv_done)   state <= ST_R1_START;
                ST_R1_START:                  state <= ST_R1_WAIT;
                ST_R1_WAIT:  if (relu_done)   state <= ST_P1_START;
                ST_P1_START:                  state <= ST_P1_WAIT;
                ST_P1_WAIT:  if (pool_done)   state <= ST_C2_START;
                ST_C2_START:                  state <= ST_C2_WAIT;
                ST_C2_WAIT:  if (conv_done)   state <= ST_R2_START;
                ST_R2_START:                  state <= ST_R2_WAIT;
                ST_R2_WAIT:  if (relu_done)   state <= ST_P2_START;
                ST_P2_START:                  state <= ST_P2_WAIT;
                ST_P2_WAIT:  if (pool_done)   state <= ST_FC_START;
                ST_FC_START:                  state <= ST_FC_WAIT;
                ST_FC_WAIT:  if (fc_done)     state <= ST_R3_START;
                ST_R3_START:                  state <= ST_R3_WAIT;
                ST_R3_WAIT:  if (relu10_done) state <= ST_DONE;
                ST_DONE:                      state <= ST_IDLE;
                default:                      state <= ST_IDLE;
            endcase
        end
    end
endmodule

```



CONV1 → ReLU1 → POOL1 → CONV2 → ReLU2 → POOL2 → FC →ReLU10 순서에 맞게 start와 wait 신호를 주는 FSM임.

<h4 class="lenet-original-heading">Byte Selector</h4>

<h5 class="lenet-original-heading">byte_selector.v</h5>



```verilog
`timescale 1ns/1ps

// Select one byte from a packed 32-bit word.
module byte_selector (
    input  wire [31:0] word_in,
    input  wire [1:0]  byte_sel,
    output reg  [7:0]  byte_out
);
    always @* begin
        case (byte_sel)
            2'd0: byte_out = word_in[7:0];
            2'd1: byte_out = word_in[15:8];
            2'd2: byte_out = word_in[23:16];
            2'd3: byte_out = word_in[31:24];
            default: byte_out = 8'd0;
        endcase
    end
endmodule

```



Image BRAM과 Weight BRAM은 8비트 데이터를 하나씩 저장하지 않고, 4개씩 32비트 word로 packing해서 저장하기 때문에 8비트씩 끊어야 하는거임.

byte_selector.v 는 32비트 BRAM word 안에 묶여 있는 4개의 8비트 값 중 하나를 골라내는 조합논리 모듈임.

<h4 class="lenet-original-heading">Conv Engine</h4>

<h5 class="lenet-original-heading">conv_engine.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// Shared single-MAC convolution engine.
// layer_sel = 0: CONV1
// layer_sel = 1: CONV2
//
// Assumptions:
// - image/weight/fmap read ports have one clock of synchronous read latency.
// - output is stored as signed int32 without quantization.
// - no bias, stride=1, padding=0.
// -----------------------------------------------------------------------------
module conv_engine (
    input  wire         clk,
    input  wire         rst_n,
    input  wire         start,
    input  wire         layer_sel,

    output reg          busy,
    output reg          done,
    output reg          overflow_error,

    output reg  [7:0]   image_raddr,
    input  wire [31:0]  image_rdata,

    output reg  [9:0]   weight_raddr,
    input  wire [31:0]  weight_rdata,

    output reg  [11:0]  fmap_raddr,
    input  wire [31:0]  fmap_rdata,

    output wire         fmap_we,
    output reg  [11:0]  fmap_waddr,
    output reg  [31:0]  fmap_wdata
);
    localparam S_IDLE  = 3'd0;
    localparam S_ISSUE = 3'd1;
    localparam S_WAIT  = 3'd2;
    localparam S_MAC   = 3'd3;
    localparam S_WRITE = 3'd4;

    reg [2:0] state;
    reg       mode;

    reg [3:0] oc;
    reg [2:0] ic;
    reg [4:0] out_row;
    reg [4:0] out_col;
    reg [2:0] kh;
    reg [2:0] kw;

    reg signed [63:0] accumulator;
    reg signed [31:0] result_reg;

    reg [1:0] image_byte_sel;
    reg [1:0] weight_byte_sel;

    wire [7:0] selected_image_byte;
    wire [7:0] selected_weight_byte_u;
    wire signed [7:0] selected_weight_byte;

    byte_selector u_image_byte_selector (
        .word_in  (image_rdata),
        .byte_sel (image_byte_sel),
        .byte_out (selected_image_byte)
    );

    byte_selector u_weight_byte_selector (
        .word_in  (weight_rdata),
        .byte_sel (weight_byte_sel),
        .byte_out (selected_weight_byte_u)
    );

    assign selected_weight_byte = $signed(selected_weight_byte_u);

    wire signed [31:0] activation_value =
        mode ? $signed(fmap_rdata) : $signed({24'd0, selected_image_byte});

    wire signed [39:0] product = activation_value * selected_weight_byte;
    wire signed [63:0] product_ext = {{24{product[39]}}, product};
    wire signed [63:0] sum_next = accumulator + product_ext;

    wire result_overflow =
        (sum_next[63:32] != {32{sum_next[31]}});

    wire [4:0] out_width  = mode ? 5'd8  : 5'd24;
    wire [4:0] out_height = mode ? 5'd8  : 5'd24;
    wire [3:0] out_channels = mode ? 4'd12 : 4'd4;
    wire [2:0] in_channels  = mode ? 3'd4  : 3'd1;

    wire last_inner =
        (kw == 3'd4) &&
        (kh == 3'd4) &&
        (ic == in_channels - 1'b1);

    wire last_output =
        (out_col == out_width - 1'b1) &&
        (out_row == out_height - 1'b1) &&
        (oc == out_channels - 1'b1);

    integer image_byte_index_i;
    integer fmap_input_addr_i;
    integer weight_byte_index_i;
    integer output_addr_i;

    always @* begin
        image_byte_index_i = 0;
        fmap_input_addr_i = 0;
        weight_byte_index_i = 0;
        output_addr_i = 0;

        image_raddr = 8'd0;
        image_byte_sel = 2'd0;
        fmap_raddr = 12'd0;
        weight_raddr = 10'd0;
        weight_byte_sel = 2'd0;
        fmap_waddr = 12'd0;
        fmap_wdata = result_reg;

        if (!mode) begin
            image_byte_index_i =
                (out_row + kh) * 28 + (out_col + kw);
            weight_byte_index_i =
                `CONV1_WEIGHT_BYTE_BASE + oc * 25 + kh * 5 + kw;
            output_addr_i =
                `CONV1_OUT_BASE + oc * 576 + out_row * 24 + out_col;

            image_raddr = image_byte_index_i >> 2;
            image_byte_sel = image_byte_index_i[1:0];
        end else begin
            fmap_input_addr_i =
                ic * 144 + (out_row + kh) * 12 + (out_col + kw);
            weight_byte_index_i =
                `CONV2_WEIGHT_BYTE_BASE + oc * 100 + ic * 25 + kh * 5 + kw;
            output_addr_i =
                `CONV2_OUT_BASE + oc * 64 + out_row * 8 + out_col;

            fmap_raddr = fmap_input_addr_i[11:0];
        end

        weight_raddr = weight_byte_index_i >> 2;
        weight_byte_sel = weight_byte_index_i[1:0];
        fmap_waddr = output_addr_i[11:0];
    end

    assign fmap_we = (state == S_WRITE);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= S_IDLE;
            mode <= 1'b0;
            busy <= 1'b0;
            done <= 1'b0;
            overflow_error <= 1'b0;
            oc <= 4'd0;
            ic <= 3'd0;
            out_row <= 5'd0;
            out_col <= 5'd0;
            kh <= 3'd0;
            kw <= 3'd0;
            accumulator <= 64'sd0;
            result_reg <= 32'sd0;
        end else begin
            done <= 1'b0;

            case (state)
                S_IDLE: begin
                    busy <= 1'b0;
                    if (start) begin
                        mode <= layer_sel;
                        busy <= 1'b1;
                        overflow_error <= 1'b0;
                        oc <= 4'd0;
                        ic <= 3'd0;
                        out_row <= 5'd0;
                        out_col <= 5'd0;
                        kh <= 3'd0;
                        kw <= 3'd0;
                        accumulator <= 64'sd0;
                        state <= S_ISSUE;
                    end
                end

                S_ISSUE: begin
                    state <= S_WAIT;
                end

                S_WAIT: begin
                    // Extra explicit wait state keeps the design compatible
                    // with one-cycle synchronous BRAM read latency.
                    state <= S_MAC;
                end

                S_MAC: begin
                    if (last_inner) begin
                        result_reg <= sum_next[31:0];
                        if (result_overflow)
                            overflow_error <= 1'b1;
                        state <= S_WRITE;
                    end else begin
                        accumulator <= sum_next;

                        if (kw < 3'd4) begin
                            kw <= kw + 1'b1;
                        end else begin
                            kw <= 3'd0;
                            if (kh < 3'd4) begin
                                kh <= kh + 1'b1;
                            end else begin
                                kh <= 3'd0;
                                ic <= ic + 1'b1;
                            end
                        end
                        state <= S_ISSUE;
                    end
                end

                S_WRITE: begin
                    // fmap_we is asserted combinationally during this state.
                    if (last_output) begin
                        busy <= 1'b0;
                        done <= 1'b1;
                        state <= S_IDLE;
                    end else begin
                        ic <= 3'd0;
                        kh <= 3'd0;
                        kw <= 3'd0;
                        accumulator <= 64'sd0;

                        if (out_col < out_width - 1'b1) begin
                            out_col <= out_col + 1'b1;
                        end else begin
                            out_col <= 5'd0;
                            if (out_row < out_height - 1'b1) begin
                                out_row <= out_row + 1'b1;
                            end else begin
                                out_row <= 5'd0;
                                oc <= oc + 1'b1;
                            end
                        end
                        state <= S_ISSUE;
                    end
                end

                default: state <= S_IDLE;
            endcase
        end
    end
endmodule

```



<h5 class="lenet-original-heading">conv_engine 동작 원리</h5>

conv_engine은 CONV1과 CONV2에서 공통으로 사용하는 단일 MAC 기반 convolution 연산 모듈임.

Image BRAM 또는 Feature Map BRAM에서 입력 activation을 읽고, Weight BRAM에서 Weight를 읽어 곱셈과 누적 연산을 수행함. 계산이 끝난 결과는 Feature Map BRAM에 signed int32 형식으로 저장함.

- CONV1 입력: Image BRAM
- CONV2 입력: Feature Map BRAM
- Weight 입력: Weight BRAM
- 연산 결과: Feature Map BRAM

<h5 class="lenet-original-heading">기본 연산 과정</h5>

Convolution 출력값 하나는 입력 activation과 Weight를 곱한 결과를 모두 더하여 계산함.

출력값 = Σ 입력 activation × Weight

conv_engine은 다음 순서로 동작함.

1. 현재 출력 채널과 출력 좌표를 결정함.
2. 입력 activation이 저장된 BRAM 주소를 계산함.
3. 해당 Kernel Weight가 저장된 BRAM 주소를 계산함.
4. BRAM에 읽기 주소를 전달함.
5. BRAM의 read latency를 기다림.
6. 입력 activation과 Weight를 곱함.
7. 곱셈 결과를 accumulator에 누적함.
8. Kernel 전체 계산이 끝날 때까지 반복함.
9. 최종 결과를 Feature Map BRAM에 저장함.
10. 다음 출력 좌표로 이동함.

---

<h5 class="lenet-original-heading">CONV1 동작</h5>

CONV1은 28 × 28 입력 이미지에 5 × 5 Kernel을 적용함.

- 입력 형태: 1 × 28 × 28
- 출력 형태: 4 × 24 × 24
- 입력 채널: 1개
- 출력 채널: 4개
- 출력값 하나당 MAC 횟수: 1 × 5 × 5 = 25회

CONV1에서는 Image BRAM에서 32bit word를 읽음.

Image BRAM의 word 하나에는 8bit 픽셀 4개가 저장되어 있으므로, byte_selector를 이용해 현재 필요한 픽셀 하나를 선택함.

선택된 픽셀은 uint8 값으로 사용하고, Weight BRAM에서 선택된 Weight는 signed int8 값으로 사용함.

픽셀과 Weight를 곱한 값을 25번 누적하면 CONV1 출력값 하나가 완성됨.

CONV1 결과는 Feature Map BRAM의 주소 0부터 2303까지 저장됨.

---

<h5 class="lenet-original-heading">CONV2 동작</h5>

CONV2는 POOL1 결과가 저장된 Feature Map BRAM을 입력으로 사용함.

- 입력 형태: 4 × 12 × 12
- 출력 형태: 12 × 8 × 8
- 입력 채널: 4개
- 출력 채널: 12개
- 출력값 하나당 MAC 횟수: 4 × 5 × 5 = 100회

CONV2 입력은 이미 signed int32 형식으로 Feature Map BRAM에 저장되어 있음.

따라서 CONV2에서는 Image BRAM과 달리 byte_selector를 사용하지 않고, Feature Map BRAM에서 읽은 32bit 값을 그대로 activation으로 사용함.

4개 입력 채널에 대해 각각 5 × 5 연산을 수행하므로 출력값 하나를 만들기 위해 총 100번의 MAC 연산을 수행함.

CONV2 결과는 Feature Map BRAM의 주소 576부터 1343까지 저장됨.

---

---

<h5 class="lenet-original-heading">내부 카운터</h5>

conv_engine은 여러 개의 카운터를 사용해 현재 연산 위치를 관리함.

| 카운터 | 역할 |
| --- | --- |
| oc | 출력 채널 |
| ic | 입력 채널 |
| out_row | 출력 Feature Map의 행 |
| out_col | 출력 Feature Map의 열 |
| kh | Kernel의 행 |
| kw | Kernel의 열 |

카운터는 다음 순서로 증가함.

kw → kh → ic → out_col → out_row → oc

가장 먼저 Kernel의 열 방향을 순회하고, 이후 Kernel의 행과 입력 채널을 순회함. 하나의 출력값 계산이 끝나면 다음 출력 좌표로 이동함.

---

<h5 class="lenet-original-heading">CONV1 입력 주소 계산</h5>

현재 출력 위치가 out_row와 out_col이고, 현재 Kernel 위치가 kh와 kw라면 입력 이미지의 위치는 다음과 같음.

입력 행 = out_row + kh

입력 열 = out_col + kw

28 × 28 이미지를 1차원으로 펼친 픽셀 index는 다음과 같이 계산함.

픽셀 index = 입력 행 × 28 + 입력 열

Image BRAM에는 픽셀 4개가 하나의 32bit word에 저장되므로 word 주소와 byte 위치를 각각 계산함.

word 주소 = 픽셀 index ÷ 4

byte 선택값 = 픽셀 index % 4

Verilog에서는 다음과 같이 계산할 수 있음.



```verilog
image_raddr    = image_byte_index >> 2;
image_byte_sel = image_byte_index[1:0];
```



image_raddr는 Image BRAM에서 읽을 32bit word 주소이고, image_byte_sel은 해당 word 내부에서 선택할 픽셀 위치임.

- 예시

<h6 class="lenet-original-heading">CONV1 첫 번째 출력값 계산 예시</h6>

첫 번째 출력값은 oc = 0, out_row = 0, out_col = 0인 위치임.

이 출력값을 만들기 위해 kh와 kw가 0부터 4까지 증가하면서 총 25번의 MAC 연산을 수행함.

| MAC | kh | kw | Pixel index | Image word | Image byte | Weight index | Weight word | Weight byte |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 0 | 1 | 1 | 0 | 1 | 1 | 0 | 1 |
| 3 | 0 | 2 | 2 | 0 | 2 | 2 | 0 | 2 |
| 4 | 0 | 3 | 3 | 0 | 3 | 3 | 0 | 3 |
| 5 | 0 | 4 | 4 | 1 | 0 | 4 | 1 | 0 |
| 6 | 1 | 0 | 28 | 7 | 0 | 5 | 1 | 1 |
| 7 | 1 | 1 | 29 | 7 | 1 | 6 | 1 | 2 |
| 8 | 1 | 2 | 30 | 7 | 2 | 7 | 1 | 3 |
| 9 | 1 | 3 | 31 | 7 | 3 | 8 | 2 | 0 |
| 10 | 1 | 4 | 32 | 8 | 0 | 9 | 2 | 1 |
| … | … | … | … | … | … | … | … | … |
| 25 | 4 | 4 | 116 | 29 | 0 | 24 | 6 | 0 |

25번째 MAC 연산이 끝나면 첫 번째 CONV1 출력값이 완성됨.

완성된 결과는 Feature Map BRAM 주소 0에 저장됨.



```text
oc = 0
out_row = 0
out_col = 0

Feature Map 주소
= 0 × 576 + 0 × 24 + 0
= 0
```



---

<h6 class="lenet-original-heading">CONV1 카운터 증가 과정</h6>



```text
초기 상태

oc = 0
out_row = 0
out_col = 0
ic = 0
kh = 0
kw = 0
```



kw가 먼저 증가함.



```text
kh = 0, kw = 0
kh = 0, kw = 1
kh = 0, kw = 2
kh = 0, kw = 3
kh = 0, kw = 4
```



kw가 4에 도달하면 kw는 0으로 초기화되고 kh가 증가함.



```text
kh = 0, kw = 4
       ↓
kh = 1, kw = 0
```



kh와 kw가 모두 마지막 위치에 도달하면 하나의 출력값 계산이 완료됨.



```text
kh = 4, kw = 4
       ↓
결과를 Feature Map BRAM에 저장
       ↓
kh = 0
kw = 0
out_col = out_col + 1
```



따라서 첫 번째 출력값 계산 후 카운터는 다음과 같이 변경됨.



```text
변경 전

oc = 0
out_row = 0
out_col = 0
kh = 4
kw = 4

변경 후

oc = 0
out_row = 0
out_col = 1
kh = 0
kw = 0
```



두 번째 출력값은 Feature Map BRAM 주소 1에 저장됨.

---

<h6 class="lenet-original-heading">출력 좌표 카운터 변화</h6>

out_col은 0부터 23까지 증가함.



```text
out_row = 0

out_col = 0 → 1 → 2 → … → 23
```



out_col이 23에 도달하면 out_col은 0으로 초기화되고 out_row가 증가함.



```text
out_row = 0, out_col = 23
              ↓
out_row = 1, out_col = 0
```



out_row와 out_col이 모두 마지막 위치에 도달하면 다음 출력 채널로 이동함.



```text
oc = 0, out_row = 23, out_col = 23
                  ↓
oc = 1, out_row = 0, out_col = 0
```



CONV1 전체 카운터 범위는 다음과 같음.

- kw: 0 ~ 4
- kh: 0 ~ 4
- ic: 0
- out_col: 0 ~ 23
- out_row: 0 ~ 23
- oc: 0 ~ 3

---

<h6 class="lenet-original-heading">CONV2 첫 번째 출력값 계산 예시</h6>

첫 번째 CONV2 출력값은 다음 위치에 해당함.



```text
oc = 0
out_row = 0
out_col = 0
```



CONV2는 입력 채널이 4개이므로 각 채널에서 25번씩 총 100번 MAC 연산을 수행함.

| 구간 | ic | kh 범위 | kw 범위 | MAC 범위 |
| --- | --- | --- | --- | --- |
| 입력 채널 0 | 0 | 0 ~ 4 | 0 ~ 4 | 1 ~ 25 |
| 입력 채널 1 | 1 | 0 ~ 4 | 0 ~ 4 | 26 ~ 50 |
| 입력 채널 2 | 2 | 0 ~ 4 | 0 ~ 4 | 51 ~ 75 |
| 입력 채널 3 | 3 | 0 ~ 4 | 0 ~ 4 | 76 ~ 100 |

주요 카운터와 주소 변화는 다음과 같음.

| MAC | ic | kh | kw | Feature Map 입력 주소 | Weight byte index |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 0 | 0 | 0 | 100 |
| 2 | 0 | 0 | 1 | 1 | 101 |
| 25 | 0 | 4 | 4 | 52 | 124 |
| 26 | 1 | 0 | 0 | 144 | 125 |
| 50 | 1 | 4 | 4 | 196 | 149 |
| 51 | 2 | 0 | 0 | 288 | 150 |
| 75 | 2 | 4 | 4 | 340 | 174 |
| 76 | 3 | 0 | 0 | 432 | 175 |
| 100 | 3 | 4 | 4 | 484 | 199 |

입력 채널 0의 계산이 끝나면 kh와 kw는 0으로 초기화되고 ic가 1 증가함.



```text
ic = 0, kh = 4, kw = 4
              ↓
ic = 1, kh = 0, kw = 0
```



입력 채널 3의 마지막 Kernel 계산까지 완료되면 첫 번째 CONV2 출력값이 완성됨.

완성된 결과는 Feature Map BRAM 주소 576에 저장됨.



```text
출력 주소
= 576 + 0 × 64 + 0 × 8 + 0
= 576
```



다음 출력값은 out_col이 1 증가하며 Feature Map BRAM 주소 577에 저장됨.

---

<h6 class="lenet-original-heading">전체 카운터 변화 구조</h6>



```text
kw 증가
  │
  └─ kw가 4이면
       kw = 0
       kh 증가
          │
          └─ kh가 4이면
               kh = 0
               ic 증가
                  │
                  └─ 모든 입력 채널 완료
                       ic = 0
                       결과 BRAM 저장
                       out_col 증가
                          │
                          └─ out_col 마지막
                               out_col = 0
                               out_row 증가
                                  │
                                  └─ out_row 마지막
                                       out_row = 0
                                       oc 증가
```



CONV1은 입력 채널이 하나이므로 kh와 kw 계산이 끝나면 바로 출력값을 저장함.

CONV2는 입력 채널이 4개이므로 kh와 kw 계산이 끝날 때마다 ic를 증가시키며, 네 입력 채널의 계산이 모두 끝난 후 출력값을 저장함.


---

<h5 class="lenet-original-heading">Weight 주소 계산</h5>

Weight BRAM에는 signed int8 Weight 4개가 하나의 32bit word에 저장되어 있음.

따라서 Weight도 byte 단위 index를 먼저 계산한 다음, word 주소와 byte 위치로 나누어 사용함.

word 주소 = Weight index ÷ 4

byte 선택값 = Weight index % 4

Verilog에서는 다음과 같이 계산함.



```verilog
weight_raddr    = weight_byte_index >> 2;
weight_byte_sel = weight_byte_index[1:0];
```



Weight BRAM에서 32bit word가 출력되면 byte_selector가 현재 필요한 8bit Weight 하나를 선택함.

선택된 Weight는 signed int8 값으로 변환하여 MAC 연산에 사용함.



```verilog
wire signed [7:0] selected_weight;

assign selected_weight = $signed(selected_weight_byte);
```



---

<h5 class="lenet-original-heading">입력 activation 선택</h5>

CONV1과 CONV2는 서로 다른 BRAM을 입력으로 사용함.

CONV1에서는 Image BRAM에서 선택한 uint8 픽셀을 32bit로 확장하여 사용함.

CONV2에서는 Feature Map BRAM에서 읽은 signed int32 값을 그대로 사용함.

개념적인 선택 구조는 다음과 같음.



```verilog
wire signed [31:0] activation_value;

assign activation_value =
    mode
        ? $signed(fmap_rdata)
        : $signed({24'd0, selected_image_byte});
```



mode가 0이면 CONV1이므로 Image BRAM의 픽셀을 사용함.

mode가 1이면 CONV2이므로 Feature Map BRAM의 값을 사용함.

---

<h5 class="lenet-original-heading">MAC 연산</h5>

MAC은 Multiply-Accumulate의 약자로 곱셈과 누적 덧셈을 수행함.

accumulator = accumulator + activation × Weight

Activation은 signed 32bit이고 Weight는 signed 8bit이므로 곱셈 결과는 signed 40bit가 됨.

누적 과정에서 overflow 가능성을 줄이기 위해 accumulator는 signed 64bit로 구성함.



```verilog
wire signed [39:0] product;
wire signed [63:0] product_ext;
wire signed [63:0] sum_next;

assign product = activation_value * selected_weight;

assign product_ext =
    {{24{product[39]}}, product};

assign sum_next =
    accumulator + product_ext;
```



product는 32bit activation과 8bit Weight를 곱한 결과임.

product_ext는 40bit 곱셈 결과를 64bit signed 값으로 확장한 결과임.

sum_next는 현재 accumulator와 곱셈 결과를 더한 다음 누적값임.

---

<h5 class="lenet-original-heading">마지막 MAC 판단</h5>

CONV1에서는 입력 채널 1개의 5 × 5 Kernel 계산이 완료되면 출력값 하나가 완성됨.

CONV2에서는 입력 채널 4개에 대한 모든 5 × 5 Kernel 계산이 완료되어야 출력값 하나가 완성됨.

마지막 연산인지는 kw, kh, ic 값을 이용해 판단함.



```verilog
wire last_inner;

assign last_inner =
    (kw == 4) &&
    (kh == 4) &&
    (ic == in_channels - 1);
```



last_inner가 0이면 accumulator에 값을 저장한 후 다음 Kernel 위치로 이동함.

last_inner가 1이면 최종 누적 결과를 result_reg에 저장하고 Feature Map BRAM 쓰기 단계로 이동함.



```verilog
if (last_inner) begin
    result_reg <= sum_next[31:0];
end
else begin
    accumulator <= sum_next;
end
```



---

<h5 class="lenet-original-heading">FSM 동작</h5>

conv_engine은 FSM을 이용해 BRAM 읽기와 MAC 연산을 순서대로 제어함.

| 상태 | 역할 |
| --- | --- |
| S_IDLE | 시작 신호 대기 |
| S_ISSUE | BRAM에 읽기 주소 전달 |
| S_WAIT | BRAM read latency 대기 |
| S_MAC | 곱셈 및 누적 연산 |
| S_WRITE | 결과를 Feature Map BRAM에 저장 |

전체 상태 흐름은 다음과 같음.

S_IDLE → S_ISSUE → S_WAIT → S_MAC → S_WRITE

Kernel 연산이 아직 끝나지 않았다면 S_MAC 이후 다시 S_ISSUE로 이동함.

S_ISSUE → S_WAIT → S_MAC 과정은 출력값 하나를 완성할 때까지 반복됨.

출력값 하나가 완성되면 S_WRITE 상태에서 Feature Map BRAM에 결과를 저장함.

모든 출력 채널과 출력 좌표의 계산이 끝나면 done 신호를 발생시키고 S_IDLE 상태로 돌아감.

---

<h5 class="lenet-original-heading">S_IDLE 상태</h5>

S_IDLE은 start 신호를 기다리는 상태임.

start 신호가 들어오면 다음 작업을 수행함.

- CONV1 또는 CONV2 mode 저장
- 출력 채널 카운터 초기화
- 입력 채널 카운터 초기화
- 출력 좌표 초기화
- Kernel 좌표 초기화
- accumulator 초기화
- busy 신호 활성화



```verilog
if (start) begin
    mode        <= layer_sel;
    oc          <= 0;
    ic          <= 0;
    out_row     <= 0;
    out_col     <= 0;
    kh          <= 0;
    kw          <= 0;
    accumulator <= 0;
    busy        <= 1;
end
```



---

<h5 class="lenet-original-heading">S_ISSUE와 S_WAIT 상태</h5>

S_ISSUE에서는 현재 카운터 값을 기준으로 입력 BRAM과 Weight BRAM의 주소를 계산하여 전달함.

BRAM은 synchronous memory이므로 주소를 전달한 즉시 데이터가 출력되지 않음.

따라서 S_WAIT 상태에서 한 clock 동안 BRAM의 read latency를 기다림.

S_ISSUE에서 주소 전달 → S_WAIT에서 대기 → S_MAC에서 데이터 사용

이 대기 상태가 없으면 이전 주소에서 읽은 데이터를 현재 연산에 잘못 사용할 수 있음.

---

<h5 class="lenet-original-heading">S_WRITE 상태</h5>

출력값 하나의 모든 MAC 연산이 완료되면 S_WRITE 상태로 이동함.

S_WRITE 상태에서는 Feature Map BRAM의 write enable을 활성화하고 계산 결과를 저장함.



```verilog
assign fmap_we = (state == S_WRITE);
```



저장되는 정보는 다음과 같음.

- Write address: 현재 출력값의 Feature Map 주소
- Write data: result_reg
- Write enable: 1

결과 저장이 완료되면 다음 출력 좌표로 이동함.

출력 열이 끝나면 다음 행으로 이동하고, 출력 행이 끝나면 다음 출력 채널로 이동함.

모든 출력 채널의 연산이 완료되면 done 신호를 발생시킴.

<h4 class="lenet-original-heading">ReLU Engine</h4>

<h5 class="lenet-original-heading">relu_engine.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// In-place ReLU over the shared feature-map BRAM.
// layer_sel = 0: addresses 0..2303 (ReLU1)
// layer_sel = 1: addresses 576..1343 (ReLU2)
module relu_engine (
    input  wire         clk,
    input  wire         rst_n,
    input  wire         start,
    input  wire         layer_sel,
    output reg          busy,
    output reg          done,

    output reg  [11:0]  fmap_raddr,
    input  wire [31:0]  fmap_rdata,
    output wire         fmap_we,
    output reg  [11:0]  fmap_waddr,
    output reg  [31:0]  fmap_wdata
);
    localparam S_IDLE  = 3'd0;
    localparam S_ISSUE = 3'd1;
    localparam S_WAIT  = 3'd2;
    localparam S_EVAL  = 3'd3;
    localparam S_WRITE = 3'd4;

    reg [2:0] state;
    reg       mode;
    reg [11:0] index;
    reg [31:0] result_reg;

    wire [11:0] base_addr = mode ? 12'd576 : 12'd0;
    wire [11:0] item_count = mode ? 12'd768 : 12'd2304;
    wire [11:0] current_addr = base_addr + index;

    always @* begin
        fmap_raddr = current_addr;
        fmap_waddr = current_addr;
        fmap_wdata = result_reg;
    end

    assign fmap_we = (state == S_WRITE);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= S_IDLE;
            mode <= 1'b0;
            index <= 12'd0;
            result_reg <= 32'd0;
            busy <= 1'b0;
            done <= 1'b0;
        end else begin
            done <= 1'b0;
            case (state)
                S_IDLE: begin
                    busy <= 1'b0;
                    if (start) begin
                        mode <= layer_sel;
                        index <= 12'd0;
                        busy <= 1'b1;
                        state <= S_ISSUE;
                    end
                end

                S_ISSUE: state <= S_WAIT;
                S_WAIT:  state <= S_EVAL;

                S_EVAL: begin
                    result_reg <= fmap_rdata[31] ? 32'd0 : fmap_rdata;
                    state <= S_WRITE;
                end

                S_WRITE: begin
                    if (index == item_count - 1'b1) begin
                        busy <= 1'b0;
                        done <= 1'b1;
                        state <= S_IDLE;
                    end else begin
                        index <= index + 1'b1;
                        state <= S_ISSUE;
                    end
                end

                default: state <= S_IDLE;
            endcase
        end
    end
endmodule

```



<h5 class="lenet-original-heading">relu_engine 동작 원리</h5>

ReLU 출력 = 입력값이 음수이면 0, 그렇지 않으면 입력값 유지

relu_engine은 Feature Map BRAM에서 값을 하나씩 읽어 ReLU를 적용한 뒤, 결과를 원래 주소에 다시 저장함.

따라서 별도의 출력 BRAM을 사용하지 않고 하나의 Feature Map BRAM을 읽기와 쓰기에 함께 사용하는 in-place 구조임.

- 입력 메모리: Feature Map BRAM
- 출력 메모리: Feature Map BRAM
- 입력 데이터 형식: signed int32
- 출력 데이터 형식: signed int32
- 연산 방식: 주소 순서대로 하나씩 처리
- 주소 관리: index 카운터 하나 사용
- 저장 방식: 읽었던 주소에 결과를 다시 저장

---

<h5 class="lenet-original-heading">ReLU 연산</h5>

Feature Map 값은 signed int32 형식으로 저장되어 있음.

signed int32에서는 가장 상위 비트인 bit 31이 부호 비트임.

- bit 31이 0이면 0 또는 양수
- bit 31이 1이면 음수

relu_engine은 fmap_rdata의 bit 31을 확인하여 결과를 결정함.



```verilog
result_reg <= fmap_rdata[31] ? 32'd0 : fmap_rdata;
```



fmap_rdata의 bit 31이 1이면 result_reg에 0을 저장함.

fmap_rdata의 bit 31이 0이면 원래 fmap_rdata를 result_reg에 저장함.

---

<h5 class="lenet-original-heading">ReLU1과 ReLU2 선택</h5>

relu_engine 하나를 ReLU1과 ReLU2가 공유함.

layer_sel 신호에 따라 처리할 Feature Map BRAM 영역이 결정됨.

| layer_sel | 동작 | 시작 주소 | 처리 개수 | 마지막 주소 |
| --- | --- | --- | --- | --- |
| 0 | ReLU1 | 0 | 2,304 | 2,303 |
| 1 | ReLU2 | 576 | 768 | 1,343 |

layer_sel이 0이면 CONV1 결과 전체에 ReLU를 적용함.

CONV1 출력은 4 × 24 × 24이므로 총 2,304개의 값을 처리함.

layer_sel이 1이면 CONV2 결과 전체에 ReLU를 적용함.

CONV2 출력은 12 × 8 × 8이므로 총 768개의 값을 처리함.

start 신호가 들어오면 layer_sel 값을 mode 레지스터에 저장함.



```verilog
if (start) begin
    mode  <= layer_sel;
    index <= 12'd0;
    busy  <= 1'b1;
    state <= S_ISSUE;
end
```



mode 레지스터에 값을 저장하므로 연산이 진행되는 동안 외부의 layer_sel 신호가 변경되어도 현재 ReLU 동작에는 영향을 주지 않음.

---

<h5 class="lenet-original-heading">주소 범위 결정</h5>

mode 값에 따라 시작 주소와 처리할 데이터 개수가 선택됨.



```verilog
wire [11:0] base_addr =
    mode ? 12'd576 : 12'd0;

wire [11:0] item_count =
    mode ? 12'd768 : 12'd2304;
```



mode가 0이면 다음과 같이 설정됨.

- base_addr = 0
- item_count = 2,304
- 처리 주소 = 0부터 2,303까지

mode가 1이면 다음과 같이 설정됨.

- base_addr = 576
- item_count = 768
- 처리 주소 = 576부터 1,343까지

---

<h5 class="lenet-original-heading">내부 카운터</h5>

relu_engine은 conv_engine과 달리 출력 채널, 행, 열, Kernel 위치를 각각 관리하지 않음.

Feature Map BRAM의 값을 연속된 주소 순서대로 처리하므로 index 카운터 하나만 사용함.



```verilog
reg [11:0] index;
```



현재 처리할 주소는 base_addr와 index를 더하여 계산함.



```verilog
wire [11:0] current_addr =
    base_addr + index;
```



따라서 주소 변화는 다음과 같음.

현재 주소 = 시작 주소 + index

index는 0부터 item_count - 1까지 증가함.

---

<h5 class="lenet-original-heading">Read 주소와 Write 주소</h5>

relu_engine은 현재 주소를 Read 주소와 Write 주소에 동일하게 연결함.



```verilog
always @* begin
    fmap_raddr = current_addr;
    fmap_waddr = current_addr;
    fmap_wdata = result_reg;
end
```



따라서 하나의 데이터는 다음 과정으로 처리됨.

Feature Map BRAM 주소 N에서 값 읽기

→ ReLU 적용

→ Feature Map BRAM 주소 N에 결과 저장

---

<h5 class="lenet-original-heading">FSM 구성</h5>

relu_engine은 다섯 개의 상태로 동작함.

| 상태 | 역할 |
| --- | --- |
| S_IDLE | start 신호 대기 |
| S_ISSUE | Feature Map BRAM에 Read 주소 전달 |
| S_WAIT | BRAM Read latency 대기 |
| S_EVAL | ReLU 결과 계산 |
| S_WRITE | 결과를 원래 주소에 저장 |

전체 상태 흐름은 다음과 같음.

S_IDLE → S_ISSUE → S_WAIT → S_EVAL → S_WRITE

한 개의 Feature Map 값을 처리한 후 다음 값이 남아 있다면 index를 증가시키고 다시 S_ISSUE로 이동함.

S_ISSUE → S_WAIT → S_EVAL → S_WRITE → index 증가 → S_ISSUE

마지막 값까지 처리하면 done 신호를 발생시키고 S_IDLE 상태로 돌아감.

---

<h5 class="lenet-original-heading">S_IDLE 상태</h5>

S_IDLE 상태에서는 새로운 ReLU 작업의 시작을 기다림.

start 신호가 들어오면 다음 작업을 수행함.

- layer_sel을 mode에 저장
- index를 0으로 초기화
- busy를 1로 설정
- S_ISSUE 상태로 이동



```verilog
S_IDLE: begin
    busy <= 1'b0;

    if (start) begin
        mode  <= layer_sel;
        index <= 12'd0;
        busy  <= 1'b1;
        state <= S_ISSUE;
    end
end
```



---

<h5 class="lenet-original-heading">S_ISSUE 상태</h5>

S_ISSUE 상태에서는 현재 주소를 Feature Map BRAM의 Read 주소로 전달함.

current_addr는 base_addr와 index의 합으로 계속 계산되고 있음.



```verilog
fmap_raddr = current_addr;
```



예를 들어 ReLU1의 index가 15라면 현재 Read 주소는 다음과 같음.

현재 주소 = 0 + 15 = 15

ReLU2의 index가 15라면 현재 Read 주소는 다음과 같음.

현재 주소 = 576 + 15 = 591

S_ISSUE 상태에서는 데이터를 바로 사용하지 않고 다음 S_WAIT 상태로 이동함.



```verilog
S_ISSUE: state <= S_WAIT;
```



---

<h5 class="lenet-original-heading">S_WAIT 상태</h5>

Feature Map BRAM은 synchronous BRAM이므로 주소를 전달한 즉시 데이터가 출력되는 구조가 아님.

S_WAIT 상태에서는 BRAM의 Read 데이터가 출력될 때까지 기다림.



```verilog
S_WAIT: state <= S_EVAL;
```



전체 Read 과정은 다음과 같음.

S_ISSUE에서 주소 전달

→ S_WAIT에서 BRAM 출력 대기

→ S_EVAL에서 fmap_rdata 사용

이 상태를 분리하지 않으면 이전 주소의 데이터를 현재 주소의 데이터로 잘못 사용할 수 있음.

---

<h5 class="lenet-original-heading">S_EVAL 상태</h5>

S_EVAL 상태에서는 BRAM에서 읽은 값의 부호 비트를 검사함.



```verilog
S_EVAL: begin
    result_reg <=
        fmap_rdata[31] ? 32'd0 : fmap_rdata;

    state <= S_WRITE;
end
```



fmap_rdata의 bit 31이 1이면 음수이므로 result_reg에 0을 저장함.

bit 31이 0이면 원래 값을 result_reg에 저장함.

이 단계에서는 아직 BRAM에 쓰지 않고 ReLU 결과만 result_reg에 보관함.

---

<h5 class="lenet-original-heading">S_WRITE 상태</h5>

S_WRITE 상태에서만 Feature Map BRAM의 Write Enable이 활성화됨.



```verilog
assign fmap_we =
    state == S_WRITE;
```



Write 주소는 Read 주소와 동일한 current_addr이고, Write 데이터는 S_EVAL에서 계산된 result_reg임.

- fmap_waddr = current_addr
- fmap_wdata = result_reg
- fmap_we = 1

따라서 S_WRITE 상태 동안 현재 주소에 ReLU 결과가 기록됨.

---

<h5 class="lenet-original-heading">index 증가</h5>

현재 값을 저장한 후 마지막 데이터인지 확인함.



```verilog
if (index == item_count - 1'b1) begin
    busy  <= 1'b0;
    done  <= 1'b1;
    state <= S_IDLE;
end
else begin
    index <= index + 1'b1;
    state <= S_ISSUE;
end
```



마지막 데이터가 아니라면 index를 1 증가시킴.

index = index + 1

이후 다시 S_ISSUE 상태로 이동하여 다음 주소의 데이터를 처리함.

마지막 데이터라면 index를 증가시키지 않고 다음 작업을 수행함.

- busy를 0으로 변경
- done을 1로 설정
- S_IDLE 상태로 복귀

done은 다음 clock에서 다시 0으로 내려가므로 한 clock 동안 발생하는 완료 pulse임.

---

<h5 class="lenet-original-heading">처리 시간</h5>

Feature Map 값 하나를 처리할 때 다음 네 상태를 거침.

S_ISSUE → S_WAIT → S_EVAL → S_WRITE

따라서 값 하나당 4 clock이 필요함.

ReLU1은 총 2,304개의 값을 처리함.

ReLU1 처리 시간 = 2,304 × 4 = 9,216 clock

ReLU2는 총 768개의 값을 처리함.

ReLU2 처리 시간 = 768 × 4 = 3,072 clock

---

<h4 class="lenet-original-heading">Pool Engine</h4>

<h5 class="lenet-original-heading">pool_engine.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// Shared 2x2, stride-2 max-pooling engine.
// layer_sel = 0: POOL1, 4x24x24 -> 4x12x12, output base 0
// layer_sel = 1: POOL2, 12x8x8  -> 12x4x4,  output base 576
module pool_engine (
    input  wire         clk,
    input  wire         rst_n,
    input  wire         start,
    input  wire         layer_sel,
    output reg          busy,
    output reg          done,

    output reg  [11:0]  fmap_raddr,
    input  wire [31:0]  fmap_rdata,
    output wire         fmap_we,
    output reg  [11:0]  fmap_waddr,
    output reg  [31:0]  fmap_wdata
);
    localparam S_IDLE  = 3'd0;
    localparam S_ISSUE = 3'd1;
    localparam S_WAIT  = 3'd2;
    localparam S_EVAL  = 3'd3;
    localparam S_WRITE = 3'd4;

    reg [2:0] state;
    reg       mode;

    reg [3:0] channel;
    reg [3:0] out_row;
    reg [3:0] out_col;
    reg [1:0] pool_elem;

    reg signed [31:0] max_reg;
    reg signed [31:0] result_reg;

    wire [4:0] in_width = mode ? 5'd8 : 5'd24;
    wire [4:0] in_height = mode ? 5'd8 : 5'd24;
    wire [3:0] out_width = mode ? 4'd4 : 4'd12;
    wire [3:0] out_height = mode ? 4'd4 : 4'd12;
    wire [3:0] channels = mode ? 4'd12 : 4'd4;
    wire [11:0] input_base = mode ? 12'd576 : 12'd0;
    wire [11:0] output_base = mode ? 12'd576 : 12'd0;

    wire signed [31:0] current_value = $signed(fmap_rdata);
    wire signed [31:0] max_with_current =
        (current_value > max_reg) ? current_value : max_reg;

    wire last_output =
        (out_col == out_width - 1'b1) &&
        (out_row == out_height - 1'b1) &&
        (channel == channels - 1'b1);

    integer input_addr_i;
    integer output_addr_i;
    integer pool_row_i;
    integer pool_col_i;

    always @* begin
        pool_row_i = pool_elem[1];
        pool_col_i = pool_elem[0];

        input_addr_i = input_base +
            channel * in_height * in_width +
            (out_row * 2 + pool_row_i) * in_width +
            (out_col * 2 + pool_col_i);

        output_addr_i = output_base +
            channel * out_height * out_width +
            out_row * out_width + out_col;

        fmap_raddr = input_addr_i[11:0];
        fmap_waddr = output_addr_i[11:0];
        fmap_wdata = result_reg;
    end

    assign fmap_we = (state == S_WRITE);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= S_IDLE;
            mode <= 1'b0;
            channel <= 4'd0;
            out_row <= 4'd0;
            out_col <= 4'd0;
            pool_elem <= 2'd0;
            max_reg <= 32'sd0;
            result_reg <= 32'sd0;
            busy <= 1'b0;
            done <= 1'b0;
        end else begin
            done <= 1'b0;
            case (state)
                S_IDLE: begin
                    busy <= 1'b0;
                    if (start) begin
                        mode <= layer_sel;
                        channel <= 4'd0;
                        out_row <= 4'd0;
                        out_col <= 4'd0;
                        pool_elem <= 2'd0;
                        busy <= 1'b1;
                        state <= S_ISSUE;
                    end
                end

                S_ISSUE: state <= S_WAIT;
                S_WAIT:  state <= S_EVAL;

                S_EVAL: begin
                    if (pool_elem == 2'd0) begin
                        max_reg <= current_value;
                        pool_elem <= 2'd1;
                        state <= S_ISSUE;
                    end else if (pool_elem == 2'd3) begin
                        result_reg <= max_with_current;
                        state <= S_WRITE;
                    end else begin
                        max_reg <= max_with_current;
                        pool_elem <= pool_elem + 1'b1;
                        state <= S_ISSUE;
                    end
                end

                S_WRITE: begin
                    if (last_output) begin
                        busy <= 1'b0;
                        done <= 1'b1;
                        state <= S_IDLE;
                    end else begin
                        pool_elem <= 2'd0;
                        if (out_col < out_width - 1'b1) begin
                            out_col <= out_col + 1'b1;
                        end else begin
                            out_col <= 4'd0;
                            if (out_row < out_height - 1'b1) begin
                                out_row <= out_row + 1'b1;
                            end else begin
                                out_row <= 4'd0;
                                channel <= channel + 1'b1;
                            end
                        end
                        state <= S_ISSUE;
                    end
                end

                default: state <= S_IDLE;
            endcase
        end
    end
endmodule

```



<h5 class="lenet-original-heading">pool_engine 동작 원리</h5>

2 × 2 영역에 포함된 네 개의 activation을 순서대로 읽고, 그중 가장 큰 값을 선택하여 Feature Map BRAM에 저장함.

Pooling의 stride는 2이므로 입력 영역이 서로 겹치지 않으며, 입력 Feature Map의 가로와 세로 크기가 각각 절반으로 감소함.

- 입력 메모리: Feature Map BRAM
- 출력 메모리: Feature Map BRAM
- Pooling 방식: 2 × 2 Max Pooling
- Stride: 2
- 입력 및 출력 데이터 형식: signed int32
- 저장 방식: 동일한 Feature Map BRAM을 재사용
- 연산 방식: 입력값 4개를 순차적으로 비교

---

<h5 class="lenet-original-heading">Max Pooling 연산</h5>

출력값 하나는 입력 Feature Map의 2 × 2 영역에서 가장 큰 값으로 결정됨.

출력값 = max(입력 0, 입력 1, 입력 2, 입력 3)

예를 들어 다음과 같은 2 × 2 영역이 있다고 가정함.

| 위치 | 값 |
| --- | --- |
| 왼쪽 위 | 15 |
| 오른쪽 위 | 7 |
| 왼쪽 아래 | 32 |
| 오른쪽 아래 | 11 |

네 값 중 가장 큰 값은 32이므로 Pooling 결과는 32가 됨.

pool_engine은 네 값을 동시에 읽지 않고 Feature Map BRAM에서 하나씩 순차적으로 읽어 max_reg와 비교함.



```verilog
wire signed [31:0] current_value = $signed(fmap_rdata);

wire signed [31:0] max_with_current =
    (current_value > max_reg) ? current_value : max_reg;
```



current_value가 기존 max_reg보다 크면 current_value가 새로운 최댓값이 됨.

그렇지 않으면 기존 max_reg 값을 유지함.

---

<h5 class="lenet-original-heading">POOL1과 POOL2 선택</h5>

하나의 pool_engine이 POOL1과 POOL2를 공통으로 처리함.

layer_sel 신호에 따라 입력 크기, 출력 크기, 채널 수, BRAM 시작 주소가 결정됨.

| 구분 | POOL1 | POOL2 |
| --- | --- | --- |
| layer_sel | 0 | 1 |
| 입력 형태 | 4 × 24 × 24 | 12 × 8 × 8 |
| 출력 형태 | 4 × 12 × 12 | 12 × 4 × 4 |
| 입력 채널 수 | 4 | 12 |
| 출력값 수 | 576 | 192 |
| 입력 시작 주소 | 0 | 576 |
| 출력 시작 주소 | 0 | 576 |
| 출력 마지막 주소 | 575 | 767 |

POOL1은 CONV1과 ReLU1의 결과가 저장된 주소 0부터 2303까지를 입력으로 사용함.

Pooling 결과 576개는 Feature Map BRAM의 주소 0부터 575까지 저장됨.

POOL2는 CONV2와 ReLU2의 결과가 저장된 주소 576부터 1343까지를 입력으로 사용함.

Pooling 결과 192개는 Feature Map BRAM의 주소 576부터 767까지 저장됨.

---

<h5 class="lenet-original-heading">Mode에 따른 크기 설정</h5>

start 신호가 들어오면 layer_sel 값이 mode 레지스터에 저장됨.



```verilog
if (start) begin
    mode      <= layer_sel;
    channel   <= 4'd0;
    out_row   <= 4'd0;
    out_col   <= 4'd0;
    pool_elem <= 2'd0;
    busy      <= 1'b1;
    state     <= S_ISSUE;
end
```



저장된 mode 값에 따라 Pooling에 필요한 크기가 결정됨.



```verilog
wire [4:0] in_width =
    mode ? 5'd8 : 5'd24;

wire [4:0] in_height =
    mode ? 5'd8 : 5'd24;

wire [3:0] out_width =
    mode ? 4'd4 : 4'd12;

wire [3:0] out_height =
    mode ? 4'd4 : 4'd12;

wire [3:0] channels =
    mode ? 4'd12 : 4'd4;
```



mode가 0이면 POOL1 설정이 선택됨.

mode가 1이면 POOL2 설정이 선택됨.

---

<h5 class="lenet-original-heading">내부 카운터</h5>

pool_engine은 네 개의 카운터를 사용해 현재 처리 위치를 관리함.

| 카운터 | 역할 |
| --- | --- |
| channel | 현재 입력 및 출력 채널 |
| out_row | 출력 Feature Map의 행 |
| out_col | 출력 Feature Map의 열 |
| pool_elem | 현재 2 × 2 영역에서 읽을 원소 |

카운터의 증가 순서는 다음과 같음.

pool_elem → out_col → out_row → channel

먼저 하나의 2 × 2 영역 안에서 pool_elem이 0부터 3까지 증가함.

네 개의 값 비교가 끝나면 결과를 저장하고 out_col이 증가함.

한 행의 출력이 끝나면 out_row가 증가하며, 한 채널의 모든 출력이 끝나면 channel이 증가함.

---

<h5 class="lenet-original-heading">pool_elem과 2 × 2 위치</h5>

pool_elem은 2bit 카운터이며 0부터 3까지 증가함.

pool_elem의 상위 비트는 Pooling 영역의 행을 나타내고, 하위 비트는 열을 나타냄.



```verilog
pool_row_i = pool_elem[1];
pool_col_i = pool_elem[0];
```



| pool_elem | pool_row | pool_col | 2 × 2 영역의 위치 |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 왼쪽 위 |
| 1 | 0 | 1 | 오른쪽 위 |
| 2 | 1 | 0 | 왼쪽 아래 |
| 3 | 1 | 1 | 오른쪽 아래 |

따라서 하나의 출력값을 계산할 때 입력값을 읽는 순서는 다음과 같음.

왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래

---

<h5 class="lenet-original-heading">입력 좌표 계산</h5>

Pooling stride가 2이므로 출력 좌표 하나는 입력 Feature Map의 2 × 2 영역에 대응됨.

현재 출력 좌표가 out_row와 out_col일 때 입력 영역의 시작 위치는 다음과 같음.

입력 시작 행 = out_row × 2

입력 시작 열 = out_col × 2

pool_elem에 따라 현재 읽을 실제 입력 위치가 결정됨.

입력 행 = out_row × 2 + pool_row

입력 열 = out_col × 2 + pool_col

예를 들어 out_row가 1이고 out_col이 2라면 입력 영역의 시작 위치는 다음과 같음.

입력 시작 행 = 1 × 2 = 2

입력 시작 열 = 2 × 2 = 4

따라서 읽는 2 × 2 입력 좌표는 다음과 같음.

| pool_elem | 입력 행 | 입력 열 |
| --- | --- | --- |
| 0 | 2 | 4 |
| 1 | 2 | 5 |
| 2 | 3 | 4 |
| 3 | 3 | 5 |

---

<h5 class="lenet-original-heading">입력 BRAM 주소 계산</h5>

Feature Map은 채널 우선 형태로 1차원 BRAM 주소에 저장됨.

입력 주소는 다음 요소를 더해서 계산함.

입력 시작 주소

- 현재 채널 offset
- 현재 입력 행 offset
- 현재 입력 열

전체 계산식은 다음과 같음.

입력 주소 = input_base + channel × 입력 높이 × 입력 너비 + 입력 행 × 입력 너비 + 입력 열

실제 Verilog 코드는 다음과 같음.



```verilog
input_addr_i = input_base +
    channel * in_height * in_width +
    (out_row * 2 + pool_row_i) * in_width +
    (out_col * 2 + pool_col_i);
```



계산된 주소가 Feature Map BRAM의 Read 주소로 전달됨.



```verilog
fmap_raddr = input_addr_i[11:0];
```



---

<h5 class="lenet-original-heading">출력 BRAM 주소 계산</h5>

Pooling 결과는 채널과 출력 좌표 순서로 연속 저장됨.

출력 주소 계산식은 다음과 같음.

출력 주소 = output_base + channel × 출력 높이 × 출력 너비 + out_row × 출력 너비 + out_col

실제 Verilog 코드는 다음과 같음.



```verilog
output_addr_i = output_base +
    channel * out_height * out_width +
    out_row * out_width +
    out_col;
```



계산된 주소가 Feature Map BRAM의 Write 주소로 전달됨.



```verilog
fmap_waddr = output_addr_i[11:0];
fmap_wdata = result_reg;
```



---

<h5 class="lenet-original-heading">POOL1 첫 번째 출력값 계산</h5>

POOL1의 첫 번째 출력값은 다음 조건에서 계산됨.

- channel = 0
- out_row = 0
- out_col = 0
- input_base = 0
- output_base = 0
- 입력 너비 = 24

pool_elem이 0부터 3까지 증가하면서 다음 네 개의 주소를 읽음.

| pool_elem | pool_row | pool_col | 입력 좌표 | 입력 주소 |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 행 0, 열 0 | 0 |
| 1 | 0 | 1 | 행 0, 열 1 | 1 |
| 2 | 1 | 0 | 행 1, 열 0 | 24 |
| 3 | 1 | 1 | 행 1, 열 1 | 25 |

주소 계산 예시는 다음과 같음.

pool_elem이 0일 때 입력 주소 = 0 + 0 × 24 × 24 + 0 × 24 + 0 = 0

pool_elem이 1일 때 입력 주소 = 0 + 0 × 24 × 24 + 0 × 24 + 1 = 1

pool_elem이 2일 때 입력 주소 = 0 + 0 × 24 × 24 + 1 × 24 + 0 = 24

pool_elem이 3일 때 입력 주소 = 0 + 0 × 24 × 24 + 1 × 24 + 1 = 25

네 값 중 최댓값은 다음 주소에 저장됨.

출력 주소 = 0 + 0 × 12 × 12 + 0 × 12 + 0 = 0

따라서 첫 번째 POOL1 결과는 Feature Map BRAM 주소 0에 저장됨.

---

<h5 class="lenet-original-heading">POOL1 두 번째 출력값 계산</h5>

첫 번째 출력값 저장이 완료되면 out_col이 1로 증가함.

두 번째 출력 좌표는 다음과 같음.

- channel = 0
- out_row = 0
- out_col = 1

Stride가 2이므로 입력 영역은 열 방향으로 두 칸 이동함.

| pool_elem | 입력 좌표 | 입력 주소 |
| --- | --- | --- |
| 0 | 행 0, 열 2 | 2 |
| 1 | 행 0, 열 3 | 3 |
| 2 | 행 1, 열 2 | 26 |
| 3 | 행 1, 열 3 | 27 |

네 값 중 최댓값은 출력 주소 1에 저장됨.

출력 주소 = 0 + 0 × 144 + 0 × 12 + 1 = 1

---

<h5 class="lenet-original-heading">POOL1 출력 행 변경</h5>

POOL1의 out_col은 0부터 11까지 증가함.

out_col이 11인 출력값까지 저장하면 첫 번째 출력 행이 완료됨.

이후 다음과 같이 카운터가 변경됨.

out_col = 11, out_row = 0

→ out_col = 0, out_row = 1

out_row가 증가하면 입력 영역은 행 방향으로 두 칸 이동함.

출력 좌표가 out_row 1, out_col 0일 때 입력 영역은 다음과 같음.

| pool_elem | 입력 좌표 | 입력 주소 |
| --- | --- | --- |
| 0 | 행 2, 열 0 | 48 |
| 1 | 행 2, 열 1 | 49 |
| 2 | 행 3, 열 0 | 72 |
| 3 | 행 3, 열 1 | 73 |

---

<h5 class="lenet-original-heading">POOL1 채널 변경</h5>

출력 채널 하나에는 12 × 12, 총 144개의 Pooling 결과가 존재함.

channel 0의 마지막 출력 주소는 143임.

channel 0의 마지막 출력 좌표는 다음과 같음.

- channel = 0
- out_row = 11
- out_col = 11

해당 결과를 저장한 후 카운터는 다음과 같이 변경됨.

channel = 0, out_row = 11, out_col = 11

→ channel = 1, out_row = 0, out_col = 0

POOL1 입력에서 채널 하나는 24 × 24, 총 576개의 값을 차지함.

따라서 channel 1의 첫 번째 입력 주소는 576임.

channel 1의 첫 번째 출력 주소는 144임.

---

<h5 class="lenet-original-heading">POOL2 첫 번째 출력값 계산</h5>

POOL2의 첫 번째 출력값은 다음 조건에서 계산됨.

- channel = 0
- out_row = 0
- out_col = 0
- input_base = 576
- output_base = 576
- 입력 너비 = 8

pool_elem에 따른 입력 주소는 다음과 같음.

| pool_elem | 입력 좌표 | 입력 주소 |
| --- | --- | --- |
| 0 | 행 0, 열 0 | 576 |
| 1 | 행 0, 열 1 | 577 |
| 2 | 행 1, 열 0 | 584 |
| 3 | 행 1, 열 1 | 585 |

네 값 중 최댓값은 Feature Map BRAM 주소 576에 저장됨.

출력 주소 = 576 + 0 × 4 × 4 + 0 × 4 + 0 = 576

---

<h5 class="lenet-original-heading">최댓값 저장 과정</h5>

pool_elem이 0일 때는 비교 대상이 아직 없으므로 첫 번째 값을 max_reg에 바로 저장함.



```verilog
if (pool_elem == 2'd0) begin
    max_reg <= current_value;
    pool_elem <= 2'd1;
    state <= S_ISSUE;
end
```



pool_elem이 1 또는 2일 때는 현재 값과 max_reg를 비교한 후 더 큰 값을 max_reg에 저장함.



```verilog
else begin
    max_reg <= max_with_current;
    pool_elem <= pool_elem + 1'b1;
    state <= S_ISSUE;
end
```



pool_elem이 3일 때는 마지막 입력값과 기존 max_reg를 비교하여 최종 결과를 result_reg에 저장함.



```verilog
else if (pool_elem == 2'd3) begin
    result_reg <= max_with_current;
    state <= S_WRITE;
end
```



<h5 class="lenet-original-heading">FSM 구성</h5>

pool_engine은 다섯 개의 상태로 동작함.

| 상태 | 역할 |
| --- | --- |
| S_IDLE | start 신호 대기 |
| S_ISSUE | Feature Map BRAM에 입력 주소 전달 |
| S_WAIT | BRAM Read latency 대기 |
| S_EVAL | 현재 값과 최댓값 비교 |
| S_WRITE | 최종 Pooling 결과 저장 |

전체 상태 흐름은 다음과 같음.

S_IDLE → S_ISSUE → S_WAIT → S_EVAL

pool_elem이 0, 1, 2인 경우에는 다음 입력값을 읽기 위해 다시 S_ISSUE로 이동함.

S_ISSUE → S_WAIT → S_EVAL → pool_elem 증가 → S_ISSUE

pool_elem이 3이면 네 번째 값까지 비교가 끝난 것이므로 S_WRITE로 이동함.

S_ISSUE → S_WAIT → S_EVAL → S_WRITE

---

<h5 class="lenet-original-heading">한 개 출력값의 상태 흐름</h5>

출력값 하나를 계산할 때 상태는 다음 순서로 진행됨.



```text
pool_elem 0
S_ISSUE → S_WAIT → S_EVAL
                     ↓
                첫 번째 값을 max_reg에 저장

pool_elem 1
S_ISSUE → S_WAIT → S_EVAL
                     ↓
                두 번째 값과 비교

pool_elem 2
S_ISSUE → S_WAIT → S_EVAL
                     ↓
                세 번째 값과 비교

pool_elem 3
S_ISSUE → S_WAIT → S_EVAL
                     ↓
                네 번째 값과 비교
                     ↓
                  S_WRITE
                     ↓
          Feature Map BRAM에 결과 저장
```



각 입력값을 읽을 때 S_ISSUE, S_WAIT, S_EVAL의 세 상태를 거침.

네 개의 입력값을 처리한 후 S_WRITE 상태를 한 번 수행함.

따라서 출력값 하나를 생성하는 데 총 13 clock이 사용됨.

출력값 하나의 처리 시간 = 4 × 3 + 1 = 13 clock

---

<h5 class="lenet-original-heading">S_IDLE 상태</h5>

S_IDLE에서는 start 신호를 기다림.

start 신호가 들어오면 다음 작업을 수행함.

- layer_sel을 mode에 저장
- channel을 0으로 초기화
- out_row를 0으로 초기화
- out_col을 0으로 초기화
- pool_elem을 0으로 초기화
- busy를 1로 설정
- S_ISSUE로 이동



```verilog
S_IDLE: begin
    busy <= 1'b0;

    if (start) begin
        mode      <= layer_sel;
        channel   <= 4'd0;
        out_row   <= 4'd0;
        out_col   <= 4'd0;
        pool_elem <= 2'd0;
        busy      <= 1'b1;
        state     <= S_ISSUE;
    end
end
```



---

<h5 class="lenet-original-heading">S_ISSUE와 S_WAIT 상태</h5>

S_ISSUE에서는 현재 channel, out_row, out_col, pool_elem을 이용해 입력 주소를 생성하고 Feature Map BRAM에 전달함.



```verilog
S_ISSUE: state <= S_WAIT;
```



Feature Map BRAM은 synchronous memory이므로 주소를 전달한 즉시 데이터를 사용할 수 없음.

S_WAIT에서 BRAM의 Read latency를 기다린 뒤 S_EVAL로 이동함.



```verilog
S_WAIT: state <= S_EVAL;
```



전체 Read 과정은 다음과 같음.

S_ISSUE에서 주소 전달

→ S_WAIT에서 BRAM 출력 대기

→ S_EVAL에서 fmap_rdata 사용

---

<h5 class="lenet-original-heading">S_EVAL 상태</h5>

S_EVAL에서는 현재 읽은 값과 기존 최댓값을 비교함.

pool_elem이 0이면 현재 값을 첫 번째 비교 기준으로 저장함.

pool_elem이 1 또는 2이면 max_reg를 갱신하고 다음 입력값으로 이동함.

pool_elem이 3이면 최종 최댓값을 result_reg에 저장하고 S_WRITE로 이동함.



```verilog
S_EVAL: begin
    if (pool_elem == 2'd0) begin
        max_reg <= current_value;
        pool_elem <= 2'd1;
        state <= S_ISSUE;
    end
    else if (pool_elem == 2'd3) begin
        result_reg <= max_with_current;
        state <= S_WRITE;
    end
    else begin
        max_reg <= max_with_current;
        pool_elem <= pool_elem + 1'b1;
        state <= S_ISSUE;
    end
end
```



---

<h5 class="lenet-original-heading">S_WRITE 상태</h5>

S_WRITE 상태에서만 Feature Map BRAM의 Write Enable이 활성화됨.



```verilog
assign fmap_we = (state == S_WRITE);
```



S_WRITE 상태에서는 다음 정보가 BRAM으로 전달됨.

- Write 주소: output_addr_i
- Write 데이터: result_reg
- Write Enable: 1

결과 저장이 완료되면 현재 출력이 전체 Pooling 연산의 마지막 값인지 확인함.



```verilog
wire last_output =
    (out_col == out_width - 1'b1) &&
    (out_row == out_height - 1'b1) &&
    (channel == channels - 1'b1);
```



마지막 출력값이면 다음 작업을 수행함.

- busy를 0으로 설정
- done을 1로 설정
- S_IDLE로 이동

마지막 출력값이 아니라면 pool_elem을 0으로 초기화하고 다음 출력 좌표로 이동함.

---

<h5 class="lenet-original-heading">출력 카운터 증가</h5>

S_WRITE가 완료된 후 out_col이 먼저 증가함.



```verilog
if (out_col < out_width - 1'b1) begin
    out_col <= out_col + 1'b1;
end
```



out_col이 마지막 열이면 out_col을 0으로 초기화하고 out_row를 증가시킴.



```verilog
else begin
    out_col <= 4'd0;

    if (out_row < out_height - 1'b1) begin
        out_row <= out_row + 1'b1;
    end
```



out_row도 마지막 행이면 out_row를 0으로 초기화하고 channel을 증가시킴.



```verilog
    else begin
        out_row <= 4'd0;
        channel <= channel + 1'b1;
    end
end
```



전체 카운터 변화는 다음과 같음.

pool_elem 0 → 1 → 2 → 3

→ 결과 저장

→ out_col 증가

→ out_col 마지막이면 out_row 증가

→ out_row 마지막이면 channel 증가

---

<h5 class="lenet-original-heading">Pooling 처리 시간</h5>

POOL1의 출력 크기는 4 × 12 × 12이므로 총 576개의 출력값이 생성됨.

출력 하나당 13 clock이 필요하므로 POOL1의 내부 처리 시간은 다음과 같음.

POOL1 처리 시간 = 576 × 13 = 7,488 clock

POOL2의 출력 크기는 12 × 4 × 4이므로 총 192개의 출력값이 생성됨.

POOL2 처리 시간 = 192 × 13 = 2,496 clock

<h4 class="lenet-original-heading">FC Engine</h4>

<h5 class="lenet-original-heading">fc_engine.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// Fully-connected layer: 192 -> 10, no bias, signed int32 output.
module fc_engine (
    input  wire          clk,
    input  wire          rst_n,
    input  wire          start,
    output reg           busy,
    output reg           done,
    output reg           overflow_error,

    output reg  [11:0]   fmap_raddr,
    input  wire [31:0]   fmap_rdata,

    output reg  [9:0]    weight_raddr,
    input  wire [31:0]   weight_rdata,

    output wire [319:0]  raw_logits_flat
);
    localparam S_IDLE  = 3'd0;
    localparam S_ISSUE = 3'd1;
    localparam S_WAIT  = 3'd2;
    localparam S_MAC   = 3'd3;
    localparam S_NEXT  = 3'd4;

    reg [2:0] state;
    reg [3:0] neuron;
    reg [7:0] input_index;
    reg signed [63:0] accumulator;
    reg signed [31:0] raw_logits [0:9];

    reg [1:0] weight_byte_sel;
    wire [7:0] selected_weight_u;
    wire signed [7:0] selected_weight;

    byte_selector u_fc_weight_selector (
        .word_in  (weight_rdata),
        .byte_sel (weight_byte_sel),
        .byte_out (selected_weight_u)
    );

    assign selected_weight = $signed(selected_weight_u);

    wire signed [31:0] activation_value = $signed(fmap_rdata);
    wire signed [39:0] product = activation_value * selected_weight;
    wire signed [63:0] product_ext = {{24{product[39]}}, product};
    wire signed [63:0] sum_next = accumulator + product_ext;
    wire result_overflow =
        (sum_next[63:32] != {32{sum_next[31]}});

    integer weight_byte_index_i;
    integer g;

    always @* begin
        fmap_raddr = `POOL2_OUT_BASE + input_index;
        weight_byte_index_i =
            `FC_WEIGHT_BYTE_BASE + neuron * 192 + input_index;
        weight_raddr = weight_byte_index_i >> 2;
        weight_byte_sel = weight_byte_index_i[1:0];
    end

    generate
        genvar gi;
        for (gi = 0; gi < 10; gi = gi + 1) begin : GEN_RAW_LOGITS
            assign raw_logits_flat[gi*32 +: 32] = raw_logits[gi];
        end
    endgenerate

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= S_IDLE;
            busy <= 1'b0;
            done <= 1'b0;
            overflow_error <= 1'b0;
            neuron <= 4'd0;
            input_index <= 8'd0;
            accumulator <= 64'sd0;
            for (g = 0; g < 10; g = g + 1)
                raw_logits[g] <= 32'sd0;
        end else begin
            done <= 1'b0;
            case (state)
                S_IDLE: begin
                    busy <= 1'b0;
                    if (start) begin
                        busy <= 1'b1;
                        overflow_error <= 1'b0;
                        neuron <= 4'd0;
                        input_index <= 8'd0;
                        accumulator <= 64'sd0;
                        state <= S_ISSUE;
                    end
                end

                S_ISSUE: state <= S_WAIT;
                S_WAIT:  state <= S_MAC;

                S_MAC: begin
                    if (input_index == 8'd191) begin
                        raw_logits[neuron] <= sum_next[31:0];
                        if (result_overflow)
                            overflow_error <= 1'b1;
                        state <= S_NEXT;
                    end else begin
                        accumulator <= sum_next;
                        input_index <= input_index + 1'b1;
                        state <= S_ISSUE;
                    end
                end

                S_NEXT: begin
                    if (neuron == 4'd9) begin
                        busy <= 1'b0;
                        done <= 1'b1;
                        state <= S_IDLE;
                    end else begin
                        neuron <= neuron + 1'b1;
                        input_index <= 8'd0;
                        accumulator <= 64'sd0;
                        state <= S_ISSUE;
                    end
                end

                default: state <= S_IDLE;
            endcase
        end
    end
endmodule

```



<h5 class="lenet-original-heading">fc_engine 동작 원리</h5>

fc_engine은 POOL2에서 생성된 192개의 Feature를 입력으로 받아 10개의 class score를 계산하는 Fully Connected 연산 모듈임.

POOL2 출력과 FC Weight를 순차적으로 읽고, 하나의 MAC을 반복 사용하여 각 class에 대한 결과를 계산함.

FC Layer의 구조는 다음과 같음.

192개 입력 Feature → 10개 출력 Logit

- 입력 메모리: Feature Map BRAM
- Weight 메모리: Weight BRAM
- 입력 데이터 형식: signed int32
- Weight 데이터 형식: signed int8
- 출력 데이터 형식: signed int32
- 출력 개수: 10개
- 연산 방식: 단일 MAC 반복 사용
- 출력 저장 위치: BRAM이 아닌 10개의 내부 Register

---

<h5 class="lenet-original-heading">FC 연산</h5>

각 출력 neuron은 192개의 입력 Feature와 192개의 Weight를 곱한 뒤 모두 더하여 계산함.

출력 Logit = 입력 0 × Weight 0 + 입력 1 × Weight 1 + … + 입력 191 × Weight 191

출력 neuron 하나당 192번의 MAC 연산이 필요함.

출력 neuron은 총 10개이므로 전체 MAC 횟수는 다음과 같음.

192 × 10 = 1,920 MAC

fc_engine은 1,920개의 곱셈기를 사용하는 것이 아니라 하나의 곱셈기와 accumulator를 반복 사용함.

---

<h5 class="lenet-original-heading">POOL2 출력과 FC 입력</h5>

POOL2 출력의 형태는 다음과 같음.

12 × 4 × 4 = 192개

이 192개의 값은 Feature Map BRAM 주소 576부터 767까지 저장되어 있음.

| input_index | Feature Map BRAM 주소 |
| --- | --- |
| 0 | 576 |
| 1 | 577 |
| 2 | 578 |
| … | … |
| 191 | 767 |

Feature Map BRAM의 주소는 다음과 같이 계산함.

입력 주소 = POOL2 출력 시작 주소 + input_index

POOL2 출력 시작 주소가 576이므로 다음과 같음.

입력 주소 = 576 + input_index

실제 Verilog 코드는 다음과 같음.



```verilog
fmap_raddr = `POOL2_OUT_BASE + input_index;
```



모든 출력 neuron은 동일한 192개의 입력 Feature를 사용함.

따라서 neuron이 변경될 때마다 Feature Map BRAM 주소는 다시 576부터 시작함.

---

<h5 class="lenet-original-heading">내부 카운터</h5>

fc_engine은 두 개의 주요 카운터를 사용함.

| 카운터 | 범위 | 역할 |
| --- | --- | --- |
| input_index | 0 ~ 191 | 현재 읽을 입력 Feature |
| neuron | 0 ~ 9 | 현재 계산 중인 출력 class |

카운터 증가 순서는 다음과 같음.

input_index → neuron

먼저 neuron 0에 대해 input_index를 0부터 191까지 증가시킴.

192번의 MAC 연산이 끝나면 neuron 0의 결과를 저장하고 neuron을 1 증가시킴.

이후 input_index를 다시 0으로 초기화하여 neuron 1을 계산함.

전체 카운터 변화는 다음과 같음.

neuron 0, input_index 0 → 1 → 2 → … → 191

→ neuron 0 결과 저장

→ neuron 1, input_index 0 → 1 → 2 → … → 191

→ neuron 1 결과 저장

→ 계속 반복

→ neuron 9 결과 저장

→ done 발생

---

<h5 class="lenet-original-heading">FC Weight 배치</h5>

FC Layer는 10개의 출력 neuron을 가지며, 각 neuron은 192개의 Weight를 사용함.

따라서 FC Weight 개수는 다음과 같음.

10 × 192 = 1,920개

FC Weight는 전체 Weight BRAM에서 CONV1과 CONV2 Weight 다음에 저장됨.

| Weight 종류 | Byte 범위 |
| --- | --- |
| CONV1 Weight | 0 ~ 99 |
| CONV2 Weight | 100 ~ 1,299 |
| FC Weight | 1,300 ~ 3,219 |

FC Weight의 시작 byte index는 1,300임.

각 neuron이 사용하는 Weight byte index는 다음과 같이 계산함.

Weight byte index = 1,300 + neuron × 192 + input_index

실제 Verilog 코드는 다음과 같음.



```verilog
weight_byte_index_i =
    `FC_WEIGHT_BYTE_BASE +
    neuron * 192 +
    input_index;
```



---

<h5 class="lenet-original-heading">Weight BRAM 주소 계산</h5>

Weight 하나는 signed int8이므로 8bit를 사용함.

Weight BRAM은 32bit word 하나에 Weight 4개를 저장함.

따라서 Weight byte index를 BRAM word 주소와 byte 선택값으로 분리해야 함.

Weight BRAM word 주소 = Weight byte index ÷ 4

Weight byte 선택값 = Weight byte index % 4

Verilog에서는 다음과 같이 계산함.



```verilog
weight_raddr =
    weight_byte_index_i >> 2;

weight_byte_sel =
    weight_byte_index_i[1:0];
```



weight_raddr는 읽을 32bit Weight BRAM word를 선택함.

weight_byte_sel은 해당 word 안에 들어 있는 네 개의 Weight 중 하나를 선택함.

---

<h5 class="lenet-original-heading">byte_selector 동작</h5>

Weight BRAM에서 읽은 32bit word에는 네 개의 signed int8 Weight가 들어 있음.

byte_selector는 weight_byte_sel에 따라 현재 필요한 Weight 하나를 선택함.



```verilog
byte_selector u_fc_weight_selector (
    .word_in  (weight_rdata),
    .byte_sel (weight_byte_sel),
    .byte_out (selected_weight_u)
);
```



선택된 8bit 값은 signed int8로 변환하여 MAC 연산에 사용함.



```verilog
assign selected_weight =
    $signed(selected_weight_u);
```



| weight_byte_sel | 선택되는 Weight |
| --- | --- |
| 0 | weight_rdata의 bit 7부터 0 |
| 1 | weight_rdata의 bit 15부터 8 |
| 2 | weight_rdata의 bit 23부터 16 |
| 3 | weight_rdata의 bit 31부터 24 |

---

<h5 class="lenet-original-heading">neuron 0의 주소 변화</h5>

neuron 0의 Weight byte index는 다음과 같음.

Weight byte index = 1,300 + input_index

주요 주소 변화는 다음과 같음.

| input_index | Feature Map 주소 | Weight byte index | Weight word 주소 | Weight byte 선택 |
| --- | --- | --- | --- | --- |
| 0 | 576 | 1,300 | 325 | 0 |
| 1 | 577 | 1,301 | 325 | 1 |
| 2 | 578 | 1,302 | 325 | 2 |
| 3 | 579 | 1,303 | 325 | 3 |
| 4 | 580 | 1,304 | 326 | 0 |
| 5 | 581 | 1,305 | 326 | 1 |
| … | … | … | … | … |
| 191 | 767 | 1,491 | 372 | 3 |

Weight byte 선택값은 다음과 같이 반복됨.

0 → 1 → 2 → 3 → 0 → 1 → 2 → 3

Weight 4개를 모두 사용하면 Weight BRAM word 주소가 1 증가함.

---

<h5 class="lenet-original-heading">neuron 변경 시 주소 변화</h5>

neuron 0의 192개 입력 계산이 완료되면 neuron이 1로 증가함.

이때 input_index와 accumulator는 0으로 초기화됨.

Feature Map BRAM 주소는 다시 576부터 시작함.

하지만 Weight 주소는 neuron 1의 Weight 영역으로 이동함.

neuron 1의 첫 번째 Weight byte index는 다음과 같음.

1,300 + 1 × 192 + 0 = 1,492

neuron별 Weight 범위는 다음과 같음.

| neuron | Weight byte 범위 | Weight word 범위 |
| --- | --- | --- |
| 0 | 1,300 ~ 1,491 | 325 ~ 372 |
| 1 | 1,492 ~ 1,683 | 373 ~ 420 |
| 2 | 1,684 ~ 1,875 | 421 ~ 468 |
| 3 | 1,876 ~ 2,067 | 469 ~ 516 |
| 4 | 2,068 ~ 2,259 | 517 ~ 564 |
| 5 | 2,260 ~ 2,451 | 565 ~ 612 |
| 6 | 2,452 ~ 2,643 | 613 ~ 660 |
| 7 | 2,644 ~ 2,835 | 661 ~ 708 |
| 8 | 2,836 ~ 3,027 | 709 ~ 756 |
| 9 | 3,028 ~ 3,219 | 757 ~ 804 |

각 neuron은 정확히 192개의 Weight를 사용함.

32bit word 하나에 Weight 4개가 저장되므로 neuron 하나당 사용하는 Weight word 수는 다음과 같음.

192 ÷ 4 = 48 words

---

<h5 class="lenet-original-heading">MAC 연산</h5>

Feature Map BRAM에서 읽은 입력값은 signed int32로 사용함.



```verilog
wire signed [31:0] activation_value =
    $signed(fmap_rdata);
```



Weight BRAM에서 선택한 Weight는 signed int8로 사용함.

Activation과 Weight를 곱하면 signed 40bit 결과가 생성됨.



```verilog
wire signed [39:0] product =
    activation_value * selected_weight;
```



곱셈 결과는 signed 64bit로 부호 확장함.



```verilog
wire signed [63:0] product_ext =
    {{24{product[39]}}, product};
```



확장된 곱셈 결과를 accumulator에 더함.



```verilog
wire signed [63:0] sum_next =
    accumulator + product_ext;
```



전체 MAC 연산은 다음과 같음.

accumulator = accumulator + activation × Weight

---

<h5 class="lenet-original-heading">마지막 입력 판단</h5>

input_index가 191이면 현재 neuron에 필요한 192개의 입력 계산이 모두 완료된 상태임.



```verilog
if (input_index == 8'd191) begin
    raw_logits[neuron] <= sum_next[31:0];

    if (result_overflow)
        overflow_error <= 1'b1;

    state <= S_NEXT;
end
```



마지막 MAC 결과를 accumulator에 다시 저장하는 대신 raw_logits의 현재 neuron 위치에 바로 저장함.

마지막 입력이 아니라면 accumulator를 갱신하고 input_index를 증가시킴.



```verilog
else begin
    accumulator <= sum_next;
    input_index <= input_index + 1'b1;
    state <= S_ISSUE;
end
```



---

<h5 class="lenet-original-heading">출력 Logit 저장</h5>

fc_engine은 계산 결과를 Feature Map BRAM에 저장하지 않음.

10개의 signed int32 Register 배열인 raw_logits에 결과를 저장함.



```verilog
reg signed [31:0] raw_logits [0:9];
```



| neuron | 저장 위치 |
| --- | --- |
| 0 | raw_logits 0 |
| 1 | raw_logits 1 |
| 2 | raw_logits 2 |
| … | … |
| 9 | raw_logits 9 |

따라서 fc_engine은 Feature Map BRAM과 Weight BRAM을 읽기만 하며 BRAM Write 동작은 수행하지 않음.

---

<h5 class="lenet-original-heading">raw_logits_flat 출력</h5>

10개의 raw_logits Register는 Top Module과 relu10_engine에서 사용하기 위해 하나의 320bit 신호로 결합됨.

10 × 32bit = 320bit



```verilog
generate
    genvar gi;

    for (gi = 0; gi < 10; gi = gi + 1) begin
        assign raw_logits_flat[gi*32 +: 32] =
            raw_logits[gi];
    end
endgenerate
```



각 Logit의 bit 위치는 다음과 같음.

| Logit | raw_logits_flat 범위 |
| --- | --- |
| raw_logits 0 | bit 31 ~ 0 |
| raw_logits 1 | bit 63 ~ 32 |
| raw_logits 2 | bit 95 ~ 64 |
| raw_logits 3 | bit 127 ~ 96 |
| raw_logits 4 | bit 159 ~ 128 |
| raw_logits 5 | bit 191 ~ 160 |
| raw_logits 6 | bit 223 ~ 192 |
| raw_logits 7 | bit 255 ~ 224 |
| raw_logits 8 | bit 287 ~ 256 |
| raw_logits 9 | bit 319 ~ 288 |

raw_logits_flat은 이후 relu10_engine의 입력으로 전달됨.

---

<h5 class="lenet-original-heading">FSM 구성</h5>

fc_engine은 다섯 개의 상태로 동작함.

| 상태 | 역할 |
| --- | --- |
| S_IDLE | start 신호 대기 |
| S_ISSUE | Feature Map과 Weight BRAM에 주소 전달 |
| S_WAIT | BRAM Read latency 대기 |
| S_MAC | 곱셈 및 누적 연산 수행 |
| S_NEXT | 다음 neuron으로 이동하거나 연산 완료 |

전체 상태 흐름은 다음과 같음.

S_IDLE → S_ISSUE → S_WAIT → S_MAC

현재 neuron의 입력이 아직 남아 있다면 input_index를 증가시키고 다시 S_ISSUE로 이동함.

S_ISSUE → S_WAIT → S_MAC → input_index 증가 → S_ISSUE

input_index가 191이면 현재 neuron의 결과를 저장하고 S_NEXT로 이동함.

S_ISSUE → S_WAIT → S_MAC → S_NEXT

---

<h5 class="lenet-original-heading">S_IDLE 상태</h5>

S_IDLE은 start 신호를 기다리는 상태임.

start 신호가 들어오면 다음 작업을 수행함.

- neuron을 0으로 초기화
- input_index를 0으로 초기화
- accumulator를 0으로 초기화
- overflow_error를 0으로 초기화
- busy를 1로 설정
- S_ISSUE로 이동



```verilog
S_IDLE: begin
    busy <= 1'b0;

    if (start) begin
        busy <= 1'b1;
        overflow_error <= 1'b0;
        neuron <= 4'd0;
        input_index <= 8'd0;
        accumulator <= 64'sd0;
        state <= S_ISSUE;
    end
end
```



---

<h5 class="lenet-original-heading">S_ISSUE와 S_WAIT 상태</h5>

S_ISSUE에서는 현재 neuron과 input_index 값을 기준으로 Feature Map BRAM과 Weight BRAM의 주소를 생성함.

주소는 조합논리에서 계속 계산되지만 S_ISSUE 상태를 통해 현재 주소를 BRAM에 제시함.



```verilog
S_ISSUE: state <= S_WAIT;
```



BRAM은 synchronous memory이므로 주소를 전달한 즉시 데이터를 사용할 수 없음.

S_WAIT 상태에서 BRAM Read latency를 기다린 뒤 S_MAC으로 이동함.



```verilog
S_WAIT: state <= S_MAC;
```



전체 BRAM 읽기 과정은 다음과 같음.

S_ISSUE에서 주소 전달

→ S_WAIT에서 BRAM 출력 대기

→ S_MAC에서 fmap_rdata와 weight_rdata 사용

---

<h5 class="lenet-original-heading">S_MAC 상태</h5>

S_MAC에서는 현재 입력 Feature와 Weight를 곱한 후 accumulator에 누적함.

input_index가 191이 아니라면 다음 작업을 수행함.

- accumulator에 sum_next 저장
- input_index를 1 증가
- S_ISSUE로 이동

input_index가 191이면 다음 작업을 수행함.

- 최종 sum_next를 raw_logits의 현재 neuron 위치에 저장
- overflow 여부 확인
- S_NEXT로 이동



```verilog
S_MAC: begin
    if (input_index == 8'd191) begin
        raw_logits[neuron] <= sum_next[31:0];

        if (result_overflow)
            overflow_error <= 1'b1;

        state <= S_NEXT;
    end
    else begin
        accumulator <= sum_next;
        input_index <= input_index + 1'b1;
        state <= S_ISSUE;
    end
end
```



---

<h5 class="lenet-original-heading">S_NEXT 상태</h5>

S_NEXT에서는 현재 계산한 neuron이 마지막 neuron인지 확인함.



```verilog
S_NEXT: begin
    if (neuron == 4'd9) begin
        busy <= 1'b0;
        done <= 1'b1;
        state <= S_IDLE;
    end
    else begin
        neuron <= neuron + 1'b1;
        input_index <= 8'd0;
        accumulator <= 64'sd0;
        state <= S_ISSUE;
    end
end
```



neuron이 9이면 10개 Logit 계산이 모두 끝난 상태임.

따라서 busy를 0으로 내리고 done을 1로 설정한 후 S_IDLE로 돌아감.

neuron이 9가 아니면 다음 neuron 계산을 위해 다음 값을 초기화함.

- neuron = neuron + 1
- input_index = 0
- accumulator = 0

Feature Map 입력 주소는 다시 576으로 돌아가고, Weight 주소는 다음 neuron의 Weight 영역으로 이동함.

---

<h5 class="lenet-original-heading">Overflow 검사</h5>

누적 연산은 signed 64bit accumulator에서 수행하지만 최종 Logit은 signed 32bit로 저장함.

따라서 최종 sum_next가 signed 32bit 범위에 들어오는지 검사함.



```verilog
wire result_overflow =
    sum_next[63:32] != {32{sum_next[31]}};
```



정상적인 signed 32bit 값이라면 상위 32bit가 bit 31의 sign extension과 같아야 함.

Overflow가 감지되면 overflow_error를 1로 설정함.



```verilog
if (result_overflow)
    overflow_error <= 1'b1;
```



overflow_error는 한 번 1이 되면 현재 FC 연산이 끝날 때까지 유지되는 sticky flag임.

다음 start 신호가 들어오면 다시 0으로 초기화됨.

Overflow가 발생해도 연산을 중단하지는 않으며 최종 결과의 하위 32bit를 raw_logits에 저장함.

---

<h5 class="lenet-original-heading">한 개 입력의 처리 흐름</h5>

하나의 input_index를 처리할 때 다음 세 상태를 거침.

| 상태 | 수행 작업 |
| --- | --- |
| S_ISSUE | Feature Map과 Weight 주소 전달 |
| S_WAIT | BRAM Read latency 대기 |
| S_MAC | 입력과 Weight를 곱하고 누적 |

따라서 입력 Feature 하나당 기본적으로 3 clock이 필요함.

현재 neuron의 마지막 입력까지 처리하면 S_NEXT 상태를 추가로 거침.

출력 neuron 하나의 처리 시간은 다음과 같음.

192 × 3 + 1 = 577 clock

10개 neuron의 내부 처리 시간은 다음과 같음.

577 × 10 = 5,770 clock

<h4 class="lenet-original-heading">ReLU10 Engine</h4>

<h5 class="lenet-original-heading">relu10_engine.v</h5>



```verilog
`timescale 1ns/1ps

// ReLU for the ten FC outputs. 
module relu10_engine (
    input  wire         clk,
    input  wire         rst_n,
    input  wire         start,
    input  wire [319:0] raw_logits_flat,
    output reg          done,
    output reg  [319:0] logits_flat
);
    integer i;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            done <= 1'b0;
            logits_flat <= 320'd0;
        end else begin
            done <= 1'b0;
            if (start) begin
                for (i = 0; i < 10; i = i + 1) begin
                    if (raw_logits_flat[i*32 + 31])
                        logits_flat[i*32 +: 32] <= 32'd0;
                    else
                        logits_flat[i*32 +: 32] <= raw_logits_flat[i*32 +: 32];
                end
                done <= 1'b1;
            end
        end
    end
endmodule

```



<h5 class="lenet-original-heading">relu10_engine 동작 원리</h5>

relu10_engine은 fc_engine에서 계산된 10개의 FC 출력값에 ReLU를 적용하는 모듈임.

fc_engine의 출력은 10개의 signed int32 Logit으로 구성되며, relu10_engine은 각 Logit의 부호를 확인함.

- 입력값이 음수이면 0으로 변경함
- 입력값이 0 이상이면 기존 값을 유지함

처리된 10개의 결과는 이후 Argmax 모듈로 전달되어 가장 큰 값을 가진 class가 최종 예측 결과로 선택됨.

전체 데이터 흐름은 다음과 같음.

FC Engine

→ Raw Logits 10개

→ relu10_engine

→ ReLU가 적용된 Logits 10개

→ Argmax

---

<h5 class="lenet-original-heading">입출력 신호</h5>



```verilog
module relu10_engine (
    input  wire         clk,
    input  wire         rst_n,
    input  wire         start,
    input  wire [319:0] raw_logits_flat,
    output reg          done,
    output reg  [319:0] logits_flat
);
```



| 신호 | 방향 | 크기 | 역할 |
| --- | --- | --- | --- |
| clk | 입력 | 1bit | 동작 기준 Clock |
| rst_n | 입력 | 1bit | Active Low Reset |
| start | 입력 | 1bit | ReLU 연산 시작 신호 |
| raw_logits_flat | 입력 | 320bit | fc_engine에서 계산된 10개의 Raw Logit |
| done | 출력 | 1bit | ReLU 처리 완료 신호 |
| logits_flat | 출력 | 320bit | ReLU가 적용된 10개의 Logit |

relu10_engine은 BRAM을 사용하지 않음.

fc_engine에서 Register 형태로 출력된 320bit raw_logits_flat을 직접 입력받아 처리함.

---

<h5 class="lenet-original-heading">320bit 데이터 구성</h5>

FC 출력값 하나는 signed int32이므로 32bit를 차지함.

출력값이 10개이므로 전체 입력 크기는 다음과 같음.

10 × 32bit = 320bit

raw_logits_flat 내부의 데이터 배치는 다음과 같음.

| Class | Raw Logit | Bit 범위 |
| --- | --- | --- |
| 0 | Raw Logit 0 | 31 ~ 0 |
| 1 | Raw Logit 1 | 63 ~ 32 |
| 2 | Raw Logit 2 | 95 ~ 64 |
| 3 | Raw Logit 3 | 127 ~ 96 |
| 4 | Raw Logit 4 | 159 ~ 128 |
| 5 | Raw Logit 5 | 191 ~ 160 |
| 6 | Raw Logit 6 | 223 ~ 192 |
| 7 | Raw Logit 7 | 255 ~ 224 |
| 8 | Raw Logit 8 | 287 ~ 256 |
| 9 | Raw Logit 9 | 319 ~ 288 |

각 Logit은 다음 방식으로 선택됨.



```verilog
raw_logits_flat[i*32 +: 32]
```



i가 0이면 bit 0부터 시작하는 32bit를 선택함.

i가 1이면 bit 32부터 시작하는 32bit를 선택함.

i가 9이면 bit 288부터 시작하는 32bit를 선택함.

---

<h5 class="lenet-original-heading">부호 비트 확인</h5>

각 Logit은 signed int32 값이므로 가장 상위 비트가 부호 비트임.

각 Logit의 부호 비트 위치는 다음과 같이 계산됨.

부호 비트 위치 = i × 32 + 31

실제 코드에서는 다음과 같이 확인함.



```verilog
raw_logits_flat[i*32 + 31]
```



| 부호 비트 | 입력값 의미 | ReLU 출력 |
| --- | --- | --- |
| 0 | 0 또는 양수 | 기존 값 유지 |
| 1 | 음수 | 0으로 변경 |

---

<h5 class="lenet-original-heading">ReLU 처리 코드</h5>



```verilog
for (i = 0; i < 10; i = i + 1) begin
    if (raw_logits_flat[i*32 + 31])
        logits_flat[i*32 +: 32] <= 32'd0;
    else
        logits_flat[i*32 +: 32]
            <= raw_logits_flat[i*32 +: 32];
end
```



for 문은 Class 0부터 Class 9까지 총 10개의 Logit을 확인함.

현재 Logit의 부호 비트가 1이면 해당 출력 영역에 0을 저장함.

부호 비트가 0이면 입력 Logit을 변경하지 않고 출력 영역에 그대로 저장함.

---

<h5 class="lenet-original-heading">10개 Logit의 병렬 처리</h5>

Verilog의 for 문이 0부터 9까지 작성되어 있지만, 실제 하드웨어가 10 clock 동안 순차적으로 반복하는 것은 아님.

합성 과정에서 각 Logit에 대한 부호 비교기와 선택 회로가 각각 생성됨.

따라서 개념적인 하드웨어 구조는 다음과 같음.

Raw Logit 0 → 부호 확인 → 0 또는 원래 값 선택

Raw Logit 1 → 부호 확인 → 0 또는 원래 값 선택

Raw Logit 2 → 부호 확인 → 0 또는 원래 값 선택

계속 반복

Raw Logit 9 → 부호 확인 → 0 또는 원래 값 선택

10개의 Logit은 같은 Clock에서 동시에 처리됨.

즉, relu10_engine은 relu_engine처럼 주소를 하나씩 증가시키며 여러 Clock에 걸쳐 처리하지 않음.

---

<h5 class="lenet-original-heading">Clock 기반 동작</h5>

relu10_engine은 start 신호가 1인 Clock 상승 Edge에서 10개의 ReLU 결과를 logits_flat Register에 저장함.



```verilog
always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        done <= 1'b0;
        logits_flat <= 320'd0;
    end
    else begin
        done <= 1'b0;

        if (start) begin
            for (i = 0; i < 10; i = i + 1) begin
                if (raw_logits_flat[i*32 + 31])
                    logits_flat[i*32 +: 32] <= 32'd0;
                else
                    logits_flat[i*32 +: 32]
                        <= raw_logits_flat[i*32 +: 32];
            end

            done <= 1'b1;
        end
    end
end
```



동작 순서는 다음과 같음.

1. start 신호가 1이 될 때까지 대기함.
2. Clock 상승 Edge에서 start 신호를 확인함.
3. 10개의 Raw Logit에 ReLU를 적용함.
4. 결과를 logits_flat Register에 저장함.
5. done을 1로 설정함.
6. 다음 Clock에서 start가 0이면 done을 다시 0으로 설정함.

---

<h5 class="lenet-original-heading">done 신호</h5>

done은 ReLU 결과가 logits_flat에 저장되었음을 알리는 완료 신호임.



```verilog
done <= 1'b0;

if (start) begin
    done <= 1'b1;
end
```



start가 한 Clock 동안만 1로 유지되면 done도 한 Clock 동안만 1이 되는 Pulse로 동작함.

| Clock | start | done | 동작 |
| --- | --- | --- | --- |
| N | 0 | 0 | 대기 |
| N + 1 | 1 | 1 | ReLU 수행 및 결과 저장 |
| N + 2 | 0 | 0 | 완료 Pulse 종료 |

상위 Controller는 done 신호를 확인한 후 다음 단계인 Argmax를 시작할 수 있음.

start 신호는 한 Clock Pulse로 입력하는 것이 적절함.

start를 여러 Clock 동안 계속 1로 유지하면 매 Clock마다 같은 입력을 다시 처리하고 done도 계속 1로 유지될 수 있음.

---

<h5 class="lenet-original-heading">Reset 동작</h5>

rst_n은 Active Low Reset 신호임.

rst_n이 0이 되면 Clock과 관계없이 done과 logits_flat이 초기화됨.



```verilog
if (!rst_n) begin
    done <= 1'b0;
    logits_flat <= 320'd0;
end
```



Reset 이후 상태는 다음과 같음.

- done = 0
- 모든 출력 Logit = 0

logits_flat은 총 320bit이므로 10개의 출력값이 모두 0으로 초기화됨.

---

<h5 class="lenet-original-heading">출력값 유지</h5>

start가 0인 상태에서는 logits_flat에 새로운 값을 대입하지 않음.

따라서 이전에 계산된 ReLU 결과가 Register에 계속 유지됨.



```verilog
else begin
    done <= 1'b0;

    if (start) begin
        ...
    end
end
```



start가 0일 때 변경되는 것은 done 신호뿐이며, logits_flat 값은 그대로 유지됨.

이 구조를 통해 Argmax 모듈이 다음 단계에서 안정된 Logit 값을 읽을 수 있음.

---

<h5 class="lenet-original-heading">처리 시간</h5>

start 신호는 Clock 상승 Edge에서 확인됨.

start가 1인 해당 Edge에서 10개의 ReLU 결과와 done이 Register에 저장됨.

따라서 모듈 내부에서 반복적인 BRAM 접근이나 다중 상태 전환은 발생하지 않음.

개념적인 처리 Latency는 1 Clock임.

| 단계 | 동작 |
| --- | --- |
| Clock N 이전 | raw_logits_flat과 start 준비 |
| Clock N 상승 Edge | 10개 ReLU 결과 계산 및 Register 저장 |
| Clock N 이후 | logits_flat과 done 출력 유효 |

for 문이 10회 작성되어 있어도 10 Clock이 걸리는 것은 아님.

합성된 하드웨어에서는 10개의 값을 병렬로 처리함.

---

<h5 class="lenet-original-heading">출력 데이터 배치</h5>

ReLU 결과도 입력과 동일한 320bit 구조로 저장됨.

| Class | logits_flat Bit 범위 |
| --- | --- |
| 0 | 31 ~ 0 |
| 1 | 63 ~ 32 |
| 2 | 95 ~ 64 |
| 3 | 127 ~ 96 |
| 4 | 159 ~ 128 |
| 5 | 191 ~ 160 |
| 6 | 223 ~ 192 |
| 7 | 255 ~ 224 |
| 8 | 287 ~ 256 |
| 9 | 319 ~ 288 |

입력과 출력의 Class 순서가 동일하게 유지되므로 별도의 재배열 과정은 필요하지 않음.

---

<h5 class="lenet-original-heading">fc_engine과 relu10_engine 연결</h5>

fc_engine은 10개의 Raw Logit을 계산한 후 raw_logits_flat으로 출력함.

relu10_engine은 이 신호를 직접 입력받음.

개념적인 연결은 다음과 같음.



```verilog
wire [319:0] raw_logits_flat;
wire [319:0] logits_flat;

fc_engine u_fc (
    .raw_logits_flat (raw_logits_flat)
);

relu10_engine u_relu10 (
    .clk             (clk),
    .rst_n           (rst_n),
    .start           (relu10_start),
    .raw_logits_flat (raw_logits_flat),
    .done            (relu10_done),
    .logits_flat     (logits_flat)
);
```



상위 Controller는 fc_engine의 done 신호를 확인한 후 relu10_start를 한 Clock 동안 활성화함.

relu10_done이 발생하면 logits_flat의 값이 유효한 상태가 됨.

---

<h5 class="lenet-original-heading">전체 처리 흐름</h5>



```text
fc_engine에서 10개 Raw Logit 계산
                ↓
         raw_logits_flat
                ↓
       relu10_start 활성화
                ↓
     10개 부호 비트 동시 확인
                ↓
  음수는 0, 나머지는 원래 값 유지
                ↓
         logits_flat 저장
                ↓
          done 신호 발생
                ↓
             Argmax
```



---

<h4 class="lenet-original-heading">Top Module</h4>

<h5 class="lenet-original-heading">lenet_baseline_top.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

module lenet_baseline_top (
    input  wire         clk,
    input  wire         rst_n,

    input  wire         start,
    output wire         busy,
    output wire         done,
    output wire         overflow_error,
    output wire [4:0]   debug_state,

    // External image loading port. Four uint8 pixels per 32-bit word.
    input  wire         image_we,
    input  wire [7:0]   image_waddr,
    input  wire [31:0]  image_wdata,

    // External weight loading port. Four int8 weights per 32-bit word.
    input  wire         weight_we,
    input  wire [9:0]   weight_waddr,
    input  wire [31:0]  weight_wdata,

    // Ten FC outputs after ReLU, packed as logit i at [i*32 +: 32].
    output wire [319:0] logits_flat
);
    // Controller control signals
    wire conv_start;
    wire conv_layer;
    wire relu_start;
    wire relu_layer;
    wire pool_start;
    wire pool_layer;
    wire fc_start;
    wire relu10_start;

    // Engine status
    wire conv_busy;
    wire conv_done;
    wire conv_overflow;
    wire relu_busy;
    wire relu_done;
    wire pool_busy;
    wire pool_done;
    wire fc_busy;
    wire fc_done;
    wire fc_overflow;
    wire relu10_done;

    // Image BRAM accelerator port
    wire [7:0] image_int_raddr;
    wire [31:0] image_int_rdata;

    // Weight BRAM accelerator port
    reg  [9:0] weight_int_raddr;
    wire [31:0] weight_int_rdata;

    // Shared feature-map BRAM accelerator ports
    reg         fmap_int_we;
    reg  [11:0] fmap_int_waddr;
    reg  [31:0] fmap_int_wdata;
    reg  [11:0] fmap_int_raddr;
    wire [31:0] fmap_int_rdata;

    // Conv engine memory ports
    wire [7:0] conv_image_raddr;
    wire [9:0] conv_weight_raddr;
    wire [11:0] conv_fmap_raddr;
    wire conv_fmap_we;
    wire [11:0] conv_fmap_waddr;
    wire [31:0] conv_fmap_wdata;

    // ReLU engine memory ports
    wire [11:0] relu_fmap_raddr;
    wire relu_fmap_we;
    wire [11:0] relu_fmap_waddr;
    wire [31:0] relu_fmap_wdata;

    // Pool engine memory ports
    wire [11:0] pool_fmap_raddr;
    wire pool_fmap_we;
    wire [11:0] pool_fmap_waddr;
    wire [31:0] pool_fmap_wdata;

    // FC engine memory ports
    wire [11:0] fc_fmap_raddr;
    wire [9:0] fc_weight_raddr;
    wire [319:0] raw_logits_flat;

    assign image_int_raddr = conv_image_raddr;
    assign overflow_error = conv_overflow | fc_overflow;

    // Prevent the external side from changing input/weights during inference.
    wire image_load_we = image_we & ~busy;
    wire weight_load_we = weight_we & ~busy;

    image_bram_wrapper u_image_bram (
        .clk       (clk),
        .ext_we    (image_load_we),
        .ext_waddr (image_waddr),
        .ext_wdata (image_wdata),
        .int_raddr (image_int_raddr),
        .int_rdata (image_int_rdata)
    );

    weight_bram_wrapper u_weight_bram (
        .clk       (clk),
        .ext_we    (weight_load_we),
        .ext_waddr (weight_waddr),
        .ext_wdata (weight_wdata),
        .int_raddr (weight_int_raddr),
        .int_rdata (weight_int_rdata)
    );

    feature_map_bram_wrapper u_feature_map_bram (
        .clk       (clk),
        .int_we    (fmap_int_we),
        .int_waddr (fmap_int_waddr),
        .int_wdata (fmap_int_wdata),
        .int_raddr (fmap_int_raddr),
        .int_rdata (fmap_int_rdata)
    );

    // Only one engine is active at a time. This mux grants the shared memories
    // to the currently busy engine.
    always @* begin
        weight_int_raddr = 10'd0;
        fmap_int_raddr = 12'd0;
        fmap_int_we = 1'b0;
        fmap_int_waddr = 12'd0;
        fmap_int_wdata = 32'd0;

        if (conv_busy) begin
            weight_int_raddr = conv_weight_raddr;
            fmap_int_raddr = conv_fmap_raddr;
            fmap_int_we = conv_fmap_we;
            fmap_int_waddr = conv_fmap_waddr;
            fmap_int_wdata = conv_fmap_wdata;
        end else if (relu_busy) begin
            fmap_int_raddr = relu_fmap_raddr;
            fmap_int_we = relu_fmap_we;
            fmap_int_waddr = relu_fmap_waddr;
            fmap_int_wdata = relu_fmap_wdata;
        end else if (pool_busy) begin
            fmap_int_raddr = pool_fmap_raddr;
            fmap_int_we = pool_fmap_we;
            fmap_int_waddr = pool_fmap_waddr;
            fmap_int_wdata = pool_fmap_wdata;
        end else if (fc_busy) begin
            weight_int_raddr = fc_weight_raddr;
            fmap_int_raddr = fc_fmap_raddr;
        end
    end

    lenet_controller u_controller (
        .clk          (clk),
        .rst_n        (rst_n),
        .start        (start),
        .conv_done    (conv_done),
        .relu_done    (relu_done),
        .pool_done    (pool_done),
        .fc_done      (fc_done),
        .relu10_done  (relu10_done),
        .conv_start   (conv_start),
        .conv_layer   (conv_layer),
        .relu_start   (relu_start),
        .relu_layer   (relu_layer),
        .pool_start   (pool_start),
        .pool_layer   (pool_layer),
        .fc_start     (fc_start),
        .relu10_start (relu10_start),
        .busy         (busy),
        .done         (done),
        .debug_state  (debug_state)
    );

    conv_engine u_conv_engine (
        .clk            (clk),
        .rst_n          (rst_n),
        .start          (conv_start),
        .layer_sel      (conv_layer),
        .busy           (conv_busy),
        .done           (conv_done),
        .overflow_error (conv_overflow),
        .image_raddr    (conv_image_raddr),
        .image_rdata    (image_int_rdata),
        .weight_raddr   (conv_weight_raddr),
        .weight_rdata   (weight_int_rdata),
        .fmap_raddr     (conv_fmap_raddr),
        .fmap_rdata     (fmap_int_rdata),
        .fmap_we        (conv_fmap_we),
        .fmap_waddr     (conv_fmap_waddr),
        .fmap_wdata     (conv_fmap_wdata)
    );

    relu_engine u_relu_engine (
        .clk        (clk),
        .rst_n      (rst_n),
        .start      (relu_start),
        .layer_sel  (relu_layer),
        .busy       (relu_busy),
        .done       (relu_done),
        .fmap_raddr (relu_fmap_raddr),
        .fmap_rdata (fmap_int_rdata),
        .fmap_we    (relu_fmap_we),
        .fmap_waddr (relu_fmap_waddr),
        .fmap_wdata (relu_fmap_wdata)
    );

    pool_engine u_pool_engine (
        .clk        (clk),
        .rst_n      (rst_n),
        .start      (pool_start),
        .layer_sel  (pool_layer),
        .busy       (pool_busy),
        .done       (pool_done),
        .fmap_raddr (pool_fmap_raddr),
        .fmap_rdata (fmap_int_rdata),
        .fmap_we    (pool_fmap_we),
        .fmap_waddr (pool_fmap_waddr),
        .fmap_wdata (pool_fmap_wdata)
    );

    fc_engine u_fc_engine (
        .clk              (clk),
        .rst_n            (rst_n),
        .start            (fc_start),
        .busy             (fc_busy),
        .done             (fc_done),
        .overflow_error   (fc_overflow),
        .fmap_raddr       (fc_fmap_raddr),
        .fmap_rdata       (fmap_int_rdata),
        .weight_raddr     (fc_weight_raddr),
        .weight_rdata     (weight_int_rdata),
        .raw_logits_flat  (raw_logits_flat)
    );

    relu10_engine u_relu10_engine (
        .clk             (clk),
        .rst_n           (rst_n),
        .start           (relu10_start),
        .raw_logits_flat (raw_logits_flat),
        .done            (relu10_done),
        .logits_flat     (logits_flat)
    );
endmodule
```



**PL timer 코드가 빠져있으니까 아래에 코드 추가 필요함**

[PL Timer](https://app.notion.com/p/PL-Timer-3ad6df6cdff98007833ffb27110bec43?pvs=21)

직접 Convolution이나 Pooling 연산을 수행하지는 않으며, 다음 기능을 담당함.

- 외부에서 이미지와 Weight를 BRAM에 적재함
- lenet_controller를 통해 전체 Layer 실행 순서를 제어함
- 각 연산 Engine에 시작 신호를 전달함
- 공유 BRAM의 접근 권한을 현재 실행 중인 Engine에 연결함
- 각 Engine의 완료 신호를 Controller로 전달함
- Convolution과 FC의 Overflow를 하나의 출력으로 결합함
- 최종 ReLU가 적용된 10개의 Logit을 외부로 출력함

전체 구조는 다음과 같음.

외부 이미지 데이터 → Image BRAM → conv_engine

외부 Weight 데이터 → Weight BRAM → conv_engine 또는 fc_engine

Feature Map BRAM ↔ conv_engine, relu_engine, pool_engine, fc_engine

fc_engine → raw_logits_flat → relu10_engine → logits_flat

lenet_controller → 각 Engine의 시작 순서 제어

---

<h5 class="lenet-original-heading">Top Module 입출력</h5>



```verilog
module lenet_baseline_top (
    input  wire         clk,
    input  wire         rst_n,

    input  wire         start,
    output wire         busy,
    output wire         done,
    output wire         overflow_error,
    output wire [4:0]   debug_state,

    input  wire         image_we,
    input  wire [7:0]   image_waddr,
    input  wire [31:0]  image_wdata,

    input  wire         weight_we,
    input  wire [9:0]   weight_waddr,
    input  wire [31:0]  weight_wdata,

    output wire [319:0] logits_flat
);
```



| 신호 | 방향 | 크기 | 역할 |
| --- | --- | --- | --- |
| clk | 입력 | 1bit | 전체 모듈의 Clock |
| rst_n | 입력 | 1bit | Active Low Reset |
| start | 입력 | 1bit | 이미지 한 장의 추론 시작 |
| busy | 출력 | 1bit | 현재 추론이 진행 중임을 표시 |
| done | 출력 | 1bit | 이미지 한 장의 추론 완료 |
| overflow_error | 출력 | 1bit | Convolution 또는 FC Overflow 발생 |
| debug_state | 출력 | 5bit | Controller의 현재 상태 |
| image_we | 입력 | 1bit | Image BRAM Write Enable |
| image_waddr | 입력 | 8bit | Image BRAM Write 주소 |
| image_wdata | 입력 | 32bit | Image BRAM Write 데이터 |
| weight_we | 입력 | 1bit | Weight BRAM Write Enable |
| weight_waddr | 입력 | 10bit | Weight BRAM Write 주소 |
| weight_wdata | 입력 | 32bit | Weight BRAM Write 데이터 |
| logits_flat | 출력 | 320bit | ReLU가 적용된 10개의 FC 출력 |

logits_flat은 32bit Logit 10개가 결합된 신호임.

Class i의 Logit은 bit i × 32부터 32bit 범위에 저장됨.

lenet_baseline_top 내부에는 Argmax가 포함되어 있지 않음.

따라서 최종 예측 Class를 얻으려면 외부 소프트웨어나 Testbench에서 logits_flat의 10개 값을 비교해야 함.

---

<h5 class="lenet-original-heading">내부 Module 구성</h5>

lenet_baseline_top 내부에는 다음 Module이 연결되어 있음.

| Module | 역할 |
| --- | --- |
| lenet_controller | 전체 Layer 실행 순서 제어 |
| image_bram_wrapper | 입력 이미지 저장 |
| weight_bram_wrapper | 전체 Weight 저장 |
| feature_map_bram_wrapper | 중간 Feature Map 저장 |
| conv_engine | CONV1과 CONV2 수행 |
| relu_engine | ReLU1과 ReLU2 수행 |
| pool_engine | POOL1과 POOL2 수행 |
| fc_engine | 192개 입력에서 10개 Logit 계산 |
| relu10_engine | FC 출력 10개에 ReLU 적용 |

전체 실행 순서는 다음과 같음.

CONV1 → ReLU1 → POOL1 → CONV2 → ReLU2 → POOL2 → FC → ReLU10

---

<h5 class="lenet-original-heading">Controller 제어 신호</h5>

lenet_controller는 각 Engine을 시작하기 위한 신호를 생성함.



```verilog
wire conv_start;
wire conv_layer;
wire relu_start;
wire relu_layer;
wire pool_start;
wire pool_layer;
wire fc_start;
wire relu10_start;
```



| 신호 | 역할 |
| --- | --- |
| conv_start | conv_engine 시작 |
| conv_layer | CONV1 또는 CONV2 선택 |
| relu_start | relu_engine 시작 |
| relu_layer | ReLU1 또는 ReLU2 선택 |
| pool_start | pool_engine 시작 |
| pool_layer | POOL1 또는 POOL2 선택 |
| fc_start | fc_engine 시작 |
| relu10_start | relu10_engine 시작 |

Layer 선택 신호가 0이면 첫 번째 Layer가 선택됨.

- conv_layer 0 → CONV1
- relu_layer 0 → ReLU1
- pool_layer 0 → POOL1

Layer 선택 신호가 1이면 두 번째 Layer가 선택됨.

- conv_layer 1 → CONV2
- relu_layer 1 → ReLU2
- pool_layer 1 → POOL2

---

<h5 class="lenet-original-heading">Engine 상태 신호</h5>

각 Engine은 busy와 done 신호를 Controller와 Top Module에 전달함.



```verilog
wire conv_busy;
wire conv_done;
wire conv_overflow;

wire relu_busy;
wire relu_done;

wire pool_busy;
wire pool_done;

wire fc_busy;
wire fc_done;
wire fc_overflow;

wire relu10_done;
```



Controller는 현재 Layer의 done 신호를 확인한 뒤 다음 Layer를 시작함.

예를 들어 CONV1이 완료되면 conv_done이 발생하고, Controller는 ReLU1 시작 상태로 이동함.

---

<h5 class="lenet-original-heading">Image BRAM 연결</h5>

Image BRAM에는 입력 이미지 한 장이 저장됨.

이미지 크기는 28 × 28이므로 총 784개의 uint8 Pixel이 존재함.

32bit Word 하나에 Pixel 4개가 저장되므로 Image BRAM에는 총 196개의 Word가 적재됨.

외부에서는 다음 신호로 Image BRAM에 데이터를 기록함.

- image_we
- image_waddr
- image_wdata

내부에서는 conv_engine만 Image BRAM을 읽음.



```verilog
assign image_int_raddr = conv_image_raddr;
```



Image BRAM의 데이터 흐름은 다음과 같음.

외부 또는 Testbench

→ image_waddr와 image_wdata

→ Image BRAM

→ conv_image_raddr

→ image_int_rdata

→ conv_engine

CONV2는 Feature Map BRAM을 입력으로 사용하므로 Image BRAM은 CONV1에서만 실제 연산에 사용됨.

---

<h5 class="lenet-original-heading">Weight BRAM 연결</h5>

Weight BRAM에는 CONV1, CONV2, FC Weight가 모두 저장됨.

외부에서는 다음 신호로 Weight BRAM에 데이터를 기록함.

- weight_we
- weight_waddr
- weight_wdata

내부에서는 conv_engine과 fc_engine이 Weight BRAM을 공유함.

CONV1과 CONV2가 실행 중이면 conv_engine의 Weight 주소가 연결됨.

FC가 실행 중이면 fc_engine의 Weight 주소가 연결됨.



```verilog
if (conv_busy) begin
    weight_int_raddr = conv_weight_raddr;
end
else if (fc_busy) begin
    weight_int_raddr = fc_weight_raddr;
end
```



Weight BRAM의 Read 데이터인 weight_int_rdata는 conv_engine과 fc_engine 양쪽에 연결되어 있음.

하지만 Controller가 두 Engine을 동시에 실행하지 않으므로 현재 활성화된 Engine만 데이터를 사용함.

---

<h5 class="lenet-original-heading">외부 BRAM Write 보호</h5>

추론이 진행되는 동안 외부에서 이미지나 Weight를 변경하면 연산 결과가 손상될 수 있음.

이를 방지하기 위해 busy가 1인 동안 외부 Write Enable을 차단함.



```verilog
wire image_load_we = image_we & ~busy;
wire weight_load_we = weight_we & ~busy;
```



동작은 다음과 같음.

| busy | image_we | 실제 Image BRAM Write |
| --- | --- | --- |
| 0 | 0 | 수행하지 않음 |
| 0 | 1 | 수행함 |
| 1 | 0 | 수행하지 않음 |
| 1 | 1 | 수행하지 않음 |

Weight BRAM도 동일하게 동작함.

따라서 이미지와 Weight는 추론을 시작하기 전에 적재해야 함.

추론 중에 image_we 또는 weight_we를 1로 설정해도 실제 BRAM Write는 발생하지 않음.

---

<h5 class="lenet-original-heading">Feature Map BRAM 공유 구조</h5>

Feature Map BRAM은 다음 네 개의 Engine이 공유함.

- conv_engine
- relu_engine
- pool_engine
- fc_engine

각 Engine은 독립적인 BRAM 주소와 Write 신호를 출력함.

하지만 Feature Map BRAM은 하나이므로 Top Module에서 현재 실행 중인 Engine의 신호만 선택해야 함.

이를 위해 다음 공유 신호를 사용함.



```verilog
reg         fmap_int_we;
reg  [11:0] fmap_int_waddr;
reg  [31:0] fmap_int_wdata;
reg  [11:0] fmap_int_raddr;
wire [31:0] fmap_int_rdata;
```



| 신호 | 역할 |
| --- | --- |
| fmap_int_raddr | Feature Map BRAM Read 주소 |
| fmap_int_rdata | Feature Map BRAM Read 데이터 |
| fmap_int_we | Feature Map BRAM Write Enable |
| fmap_int_waddr | Feature Map BRAM Write 주소 |
| fmap_int_wdata | Feature Map BRAM Write 데이터 |

---

<h5 class="lenet-original-heading">BRAM 접근 Multiplexer</h5>

현재 busy 상태인 Engine의 주소와 데이터를 Feature Map BRAM에 연결함.



```verilog
always @* begin
    weight_int_raddr = 10'd0;
    fmap_int_raddr = 12'd0;
    fmap_int_we = 1'b0;
    fmap_int_waddr = 12'd0;
    fmap_int_wdata = 32'd0;

    if (conv_busy) begin
        weight_int_raddr = conv_weight_raddr;
        fmap_int_raddr = conv_fmap_raddr;
        fmap_int_we = conv_fmap_we;
        fmap_int_waddr = conv_fmap_waddr;
        fmap_int_wdata = conv_fmap_wdata;
    end
    else if (relu_busy) begin
        fmap_int_raddr = relu_fmap_raddr;
        fmap_int_we = relu_fmap_we;
        fmap_int_waddr = relu_fmap_waddr;
        fmap_int_wdata = relu_fmap_wdata;
    end
    else if (pool_busy) begin
        fmap_int_raddr = pool_fmap_raddr;
        fmap_int_we = pool_fmap_we;
        fmap_int_waddr = pool_fmap_waddr;
        fmap_int_wdata = pool_fmap_wdata;
    end
    else if (fc_busy) begin
        weight_int_raddr = fc_weight_raddr;
        fmap_int_raddr = fc_fmap_raddr;
    end
end
```



Engine별 BRAM 사용은 다음과 같음.

| 활성 Engine | Weight BRAM | Feature Map Read | Feature Map Write |
| --- | --- | --- | --- |
| conv_engine | 사용함 | CONV2에서 사용 | 사용함 |
| relu_engine | 사용하지 않음 | 사용함 | 사용함 |
| pool_engine | 사용하지 않음 | 사용함 | 사용함 |
| fc_engine | 사용함 | 사용함 | 사용하지 않음 |

conv_engine은 CONV1에서 Image BRAM을 읽고 Feature Map BRAM에 결과를 기록함.

CONV2에서는 Feature Map BRAM을 읽고 다시 Feature Map BRAM에 결과를 기록함.

relu_engine과 pool_engine은 Feature Map BRAM을 읽고 쓰는 in-place 구조임.

fc_engine은 Feature Map BRAM과 Weight BRAM을 읽지만 결과는 내부 raw_logits Register에 저장하므로 Feature Map BRAM에 쓰지 않음.

---

<h5 class="lenet-original-heading">Multiplexer 기본값</h5>

어떤 Engine도 busy 상태가 아니면 공유 BRAM 신호는 다음 값으로 설정됨.

- Weight Read 주소 = 0
- Feature Map Read 주소 = 0
- Feature Map Write Enable = 0
- Feature Map Write 주소 = 0
- Feature Map Write 데이터 = 0

가장 중요한 것은 fmap_int_we가 0으로 설정된다는 점임.

따라서 Engine이 동작하지 않을 때 Feature Map BRAM에 의도하지 않은 데이터가 기록되지 않음.

---

<h5 class="lenet-original-heading">Engine 선택 우선순위</h5>

BRAM Multiplexer의 조건 순서는 다음과 같음.

conv_engine → relu_engine → pool_engine → fc_engine

정상적인 동작에서는 Controller가 한 번에 하나의 Engine만 실행하므로 우선순위가 실제 연산에 영향을 주지 않음.

오류로 두 개 이상의 busy 신호가 동시에 1이 되면 코드상 앞에 위치한 Engine이 BRAM 접근 권한을 가짐.

예를 들어 conv_busy와 relu_busy가 동시에 1이면 conv_engine의 주소와 Write 신호가 선택됨.

이러한 상황은 정상적인 Controller 동작에서는 발생하지 않아야 함.

---

<h5 class="lenet-original-heading">Controller 연결</h5>

Top Module은 각 Engine의 완료 신호를 Controller에 전달함.

Controller는 다음 Layer를 시작하기 위한 start 신호를 다시 출력함.



```verilog
lenet_controller u_controller (
    .clk          (clk),
    .rst_n        (rst_n),
    .start        (start),

    .conv_done    (conv_done),
    .relu_done    (relu_done),
    .pool_done    (pool_done),
    .fc_done      (fc_done),
    .relu10_done  (relu10_done),

    .conv_start   (conv_start),
    .conv_layer   (conv_layer),
    .relu_start   (relu_start),
    .relu_layer   (relu_layer),
    .pool_start   (pool_start),
    .pool_layer   (pool_layer),
    .fc_start     (fc_start),
    .relu10_start (relu10_start),

    .busy         (busy),
    .done         (done),
    .debug_state  (debug_state)
);
```



Top Module의 start는 Controller에만 직접 연결됨.

각 Engine은 외부 start를 직접 받지 않고 Controller가 생성한 개별 start 신호를 받음.

---

<h5 class="lenet-original-heading">Controller 상태 흐름</h5>

Controller는 각 Layer마다 시작 상태와 대기 상태를 구분함.

| debug_state | 상태 | 의미 |
| --- | --- | --- |
| 0 | IDLE | 외부 start 대기 |
| 1 | C1_START | CONV1 시작 신호 발생 |
| 2 | C1_WAIT | CONV1 완료 대기 |
| 3 | R1_START | ReLU1 시작 신호 발생 |
| 4 | R1_WAIT | ReLU1 완료 대기 |
| 5 | P1_START | POOL1 시작 신호 발생 |
| 6 | P1_WAIT | POOL1 완료 대기 |
| 7 | C2_START | CONV2 시작 신호 발생 |
| 8 | C2_WAIT | CONV2 완료 대기 |
| 9 | R2_START | ReLU2 시작 신호 발생 |
| 10 | R2_WAIT | ReLU2 완료 대기 |
| 11 | P2_START | POOL2 시작 신호 발생 |
| 12 | P2_WAIT | POOL2 완료 대기 |
| 13 | FC_START | FC 시작 신호 발생 |
| 14 | FC_WAIT | FC 완료 대기 |
| 15 | R3_START | ReLU10 시작 신호 발생 |
| 16 | R3_WAIT | ReLU10 완료 대기 |
| 17 | DONE | 전체 추론 완료 |

각 START 상태는 한 Clock만 유지됨.

따라서 conv_start, relu_start, pool_start, fc_start, relu10_start는 각각 한 Clock Pulse로 생성됨.

---

<h5 class="lenet-original-heading">busy와 done 동작</h5>

busy와 done은 Controller 상태에서 생성됨.

busy는 IDLE과 DONE 상태를 제외한 모든 상태에서 1임.

done은 DONE 상태에서만 1임.

개념적인 동작은 다음과 같음.

| 상태 | busy | done |
| --- | --- | --- |
| IDLE | 0 | 0 |
| Layer 실행 중 | 1 | 0 |
| DONE | 0 | 1 |
| 다음 IDLE | 0 | 0 |

DONE 상태는 한 Clock 동안 유지된 후 자동으로 IDLE로 돌아감.

따라서 done은 이미지 한 장의 처리가 끝날 때 발생하는 한 Clock 완료 Pulse임.

---

<h5 class="lenet-original-heading">CONV1 데이터 경로</h5>

CONV1이 실행되면 conv_busy가 1이 됨.

Top Module의 BRAM Multiplexer는 conv_engine의 신호를 선택함.

데이터 흐름은 다음과 같음.

Image BRAM

→ image_int_rdata

→ conv_engine

Weight BRAM

→ weight_int_rdata

→ conv_engine

conv_engine 결과

→ conv_fmap_wdata

→ Feature Map BRAM

CONV1 결과는 Feature Map BRAM 주소 0부터 2303까지 저장됨.

---

<h5 class="lenet-original-heading">ReLU1 데이터 경로</h5>

CONV1의 conv_done이 발생하면 Controller는 ReLU1을 시작함.

relu_busy가 1이 되면 Feature Map BRAM 접근 권한이 relu_engine으로 이동함.

Feature Map BRAM

→ relu_fmap_rdata

→ 음수이면 0, 0 이상이면 기존 값 유지

→ relu_fmap_wdata

→ 같은 Feature Map BRAM 주소에 덮어쓰기

---

<h5 class="lenet-original-heading">POOL1 데이터 경로</h5>

ReLU1 완료 후 pool_engine이 Feature Map BRAM 접근 권한을 가짐.

Feature Map BRAM에서 2 × 2 영역의 네 값을 읽고 최댓값을 계산함.

Pooling 결과는 Feature Map BRAM의 앞부분에 저장됨.

POOL1 결과 주소는 0부터 575까지임.

---

<h5 class="lenet-original-heading">CONV2 데이터 경로</h5>

CONV2에서는 conv_engine이 Image BRAM을 사용하지 않고 Feature Map BRAM의 POOL1 결과를 입력으로 사용함.

Feature Map BRAM

→ conv_engine의 Activation 입력

Weight BRAM

→ conv_engine의 CONV2 Weight 입력

conv_engine 결과

→ Feature Map BRAM 주소 576부터 1343까지 저장

---

<h5 class="lenet-original-heading">ReLU2와 POOL2 데이터 경로</h5>

ReLU2는 Feature Map BRAM 주소 576부터 1343까지를 읽고 같은 주소에 결과를 덮어씀.

POOL2는 해당 결과를 2 × 2 Max Pooling하여 주소 576부터 767까지 저장함.

POOL2가 끝나면 총 192개의 Feature가 FC 입력으로 준비됨.

---

<h5 class="lenet-original-heading">FC 데이터 경로</h5>

fc_engine이 실행되면 BRAM Multiplexer는 다음 주소를 선택함.

- fmap_int_raddr = fc_fmap_raddr
- weight_int_raddr = fc_weight_raddr
- fmap_int_we = 0

FC는 Feature Map BRAM 주소 576부터 767까지의 192개 값을 읽음.

동시에 Weight BRAM에서 현재 neuron에 해당하는 FC Weight를 읽음.

FC 결과는 Feature Map BRAM에 기록하지 않고 raw_logits_flat에 저장됨.



```verilog
wire [319:0] raw_logits_flat;
```



raw_logits_flat에는 ReLU가 적용되기 전의 10개 signed int32 Logit이 저장됨.

---

<h5 class="lenet-original-heading">ReLU10 데이터 경로</h5>

fc_done이 발생하면 Controller는 relu10_engine을 시작함.

relu10_engine은 BRAM을 사용하지 않고 raw_logits_flat을 직접 입력받음.



```verilog
relu10_engine u_relu10_engine (
    .clk             (clk),
    .rst_n           (rst_n),
    .start           (relu10_start),
    .raw_logits_flat (raw_logits_flat),
    .done            (relu10_done),
    .logits_flat     (logits_flat)
);
```



각 Raw Logit이 음수이면 0으로 변경되고, 0 이상이면 기존 값이 유지됨.

처리된 결과는 Top Module의 logits_flat 출력으로 전달됨.

---

<h5 class="lenet-original-heading">Overflow 결합</h5>

Overflow는 conv_engine과 fc_engine에서 검사함.



```verilog
assign overflow_error =
    conv_overflow | fc_overflow;
```



| conv_overflow | fc_overflow | overflow_error |
| --- | --- | --- |
| 0 | 0 | 0 |
| 1 | 0 | 1 |
| 0 | 1 | 1 |
| 1 | 1 | 1 |

relu_engine과 pool_engine은 곱셈이나 누적 연산을 수행하지 않으므로 별도의 Overflow 신호를 생성하지 않음.

overflow_error는 어느 Layer에서 오류가 발생했는지를 구분하지 않고, Convolution 또는 FC에서 Overflow가 발생했는지만 알려줌.

---

<h5 class="lenet-original-heading">Reset 구조</h5>

rst_n은 Controller와 모든 연산 Engine에 전달됨.

- lenet_controller
- conv_engine
- relu_engine
- pool_engine
- fc_engine
- relu10_engine

Reset이 활성화되면 Controller는 IDLE 상태로 돌아가고 각 Engine의 내부 카운터와 상태가 초기화됨.

BRAM Wrapper에는 별도의 Reset 신호가 연결되지 않음.

따라서 Reset이 발생해도 이미 적재된 Image BRAM과 Weight BRAM 데이터가 자동으로 초기화되는 구조는 아님.

새로운 데이터를 사용하려면 외부에서 BRAM을 다시 적재해야 함.

---

<h5 class="lenet-original-heading">이미지 한 장의 전체 처리 과정</h5>

1. busy가 0인지 확인함.
2. Weight BRAM에 805개의 Weight Word를 적재함.
3. Image BRAM에 이미지 한 장의 196개 Word를 적재함.
4. start를 한 Clock 동안 1로 설정함.
5. Controller가 CONV1을 시작함.
6. CONV1 완료 후 ReLU1을 시작함.
7. ReLU1 완료 후 POOL1을 시작함.
8. POOL1 완료 후 CONV2를 시작함.
9. CONV2 완료 후 ReLU2를 시작함.
10. ReLU2 완료 후 POOL2를 시작함.
11. POOL2 완료 후 FC를 시작함.
12. FC 완료 후 ReLU10을 시작함.
13. ReLU10 완료 후 done이 발생함.
14. logits_flat에서 10개의 결과를 읽음.
15. 외부 또는 Testbench에서 Argmax를 수행함.
16. Controller가 IDLE 상태로 돌아감.
17. 다음 이미지를 Image BRAM에 적재할 수 있음.

Weight는 모든 이미지가 동일하게 사용하므로 보통 처음 한 번만 적재함.

Image BRAM은 이미지 한 장을 처리할 때마다 새로운 데이터로 덮어씀.

---

<h5 class="lenet-original-heading">Top Module의 핵심 구조</h5>

lenet_baseline_top에는 복잡한 연산 카운터가 존재하지 않음.

Convolution 카운터는 conv_engine에 있음.

ReLU 주소 카운터는 relu_engine에 있음.

Pooling 카운터는 pool_engine에 있음.

FC 카운터는 fc_engine에 있음.

전체 Layer 순서 상태는 lenet_controller에 있음.

Top Module은 이 Module들의 신호를 연결하고 공유 BRAM 접근을 선택하는 배선 및 중재 역할을 수행함.

---

<h5 class="lenet-original-heading">tb_lenet_baseline.v</h5>



```verilog
`timescale 1ns/1ps

module tb_lenet_baseline;
    // ------------------------------------------------------------------
    // Test configuration
    // ------------------------------------------------------------------
    localparam integer NUM_IMAGES       = 1000;
    localparam integer WORDS_PER_IMAGE  = 196;   // 784 pixels / 4 pixels per word
    localparam integer TOTAL_IMAGE_WORDS = NUM_IMAGES * WORDS_PER_IMAGE;
    localparam integer WEIGHT_WORDS     = 805;
    localparam integer NUM_CLASSES      = 10;

    localparam integer CLK_PERIOD_NS    = 10;    // 100 MHz
    localparam time    TIMEOUT_NS       = 64'd30000000000; // 30 s modeled time

    // ------------------------------------------------------------------
    // DUT signals
    // ------------------------------------------------------------------
    reg clk;
    reg rst_n;
    reg start;

    reg         image_we;
    reg [7:0]   image_waddr;
    reg [31:0]  image_wdata;

    reg         weight_we;
    reg [9:0]   weight_waddr;
    reg [31:0]  weight_wdata;

    wire        busy;
    wire        done;
    wire        overflow_error;
    wire [4:0]  debug_state;
    wire [319:0] logits_flat;

    // ------------------------------------------------------------------
    // Test vectors
    //
    // all_image_words.hex layout:
    //   image 0 : words 0      ~ 195
    //   image 1 : words 196    ~ 391
    //   ...
    //   image n : words n*196  ~ n*196+195
    //
    // labels.hex layout:
    //   one 8-bit hexadecimal label per line, total 1000 lines
    // ------------------------------------------------------------------
    reg [31:0] weight_words    [0:WEIGHT_WORDS-1];
    reg [31:0] all_image_words [0:TOTAL_IMAGE_WORDS-1];
    reg [7:0]  labels          [0:NUM_IMAGES-1];

    // ------------------------------------------------------------------
    // Statistics and temporary variables
    // ------------------------------------------------------------------
    integer i;
    integer image_idx;
    integer prediction;
    integer signed best_value;
    integer signed current_value;

    integer correct_count;
    integer wrong_count;
    integer unknown_logit_count;

    reg [63:0] global_busy_cycles;
    reg [63:0] cycles_before_image;
    reg [63:0] image_busy_cycles;
    reg [63:0] min_busy_cycles;
    reg [63:0] max_busy_cycles;

    reg overflow_seen_any;

    time benchmark_start_time;
    time dataset_start_time;
    time dataset_end_time;
    time weight_load_end_time;

    real accuracy_percent;
    real total_pl_time_ms;
    real average_pl_time_us;
    real dataset_modeled_time_ms;
    real total_modeled_time_ms;

    // ------------------------------------------------------------------
    // DUT
    // ------------------------------------------------------------------
    lenet_baseline_top dut (
        .clk            (clk),
        .rst_n          (rst_n),
        .start          (start),
        .busy           (busy),
        .done           (done),
        .overflow_error (overflow_error),
        .debug_state    (debug_state),
        .image_we       (image_we),
        .image_waddr    (image_waddr),
        .image_wdata    (image_wdata),
        .weight_we      (weight_we),
        .weight_waddr   (weight_waddr),
        .weight_wdata   (weight_wdata),
        .logits_flat    (logits_flat)
    );

    // ------------------------------------------------------------------
    // 100 MHz clock
    // ------------------------------------------------------------------
    initial begin
        clk = 1'b0;
        forever #(CLK_PERIOD_NS/2) clk = ~clk;
    end

    // ------------------------------------------------------------------
    // Read test vectors
    // Put these files in the XSim working directory, or change the paths.
    // ------------------------------------------------------------------
    initial begin
        $readmemh("weight_words.hex",     weight_words);
        $readmemh("all_image_words.hex", all_image_words);
        $readmemh("labels.hex",           labels);
    end

    // ------------------------------------------------------------------
    // Count only cycles for which the PL controller reports busy=1.
    // This excludes weight loading, image loading, and result checking.
    // ------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            global_busy_cycles <= 64'd0;
        else if (busy)
            global_busy_cycles <= global_busy_cycles + 64'd1;
    end

    // Keep a sticky record if any layer reports int32 overflow at any time.
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            overflow_seen_any <= 1'b0;
        else if (overflow_error)
            overflow_seen_any <= 1'b1;
    end

    // ------------------------------------------------------------------
    // Main test
    // ------------------------------------------------------------------
    initial begin
        // Initial values
        rst_n          = 1'b0;
        start          = 1'b0;

        image_we       = 1'b0;
        image_waddr    = 8'd0;
        image_wdata    = 32'd0;

        weight_we      = 1'b0;
        weight_waddr   = 10'd0;
        weight_wdata   = 32'd0;

        correct_count      = 0;
        wrong_count        = 0;
        unknown_logit_count = 0;

        global_busy_cycles = 64'd0;
        overflow_seen_any  = 1'b0;

        min_busy_cycles = 64'hFFFF_FFFF_FFFF_FFFF;
        max_busy_cycles = 64'd0;

        // Reset
        repeat (5) @(posedge clk);
        @(negedge clk);
        rst_n = 1'b1;

        benchmark_start_time = $time;

        // --------------------------------------------------------------
        // Load all weights once
        // --------------------------------------------------------------
        for (i = 0; i < WEIGHT_WORDS; i = i + 1) begin
            @(negedge clk);
            weight_we    = 1'b1;
            weight_waddr = i[9:0];
            weight_wdata = weight_words[i];
        end

        @(negedge clk);
        weight_we = 1'b0;

        weight_load_end_time = $time;
        dataset_start_time   = $time;

        $display("============================================================");
        $display("LeNet RTL dataset test start");
        $display("Images             : %0d", NUM_IMAGES);
        $display("Clock              : 100 MHz");
        $display("Weight words loaded: %0d", WEIGHT_WORDS);
        $display("============================================================");

        // --------------------------------------------------------------
        // Process every image
        // --------------------------------------------------------------
        for (image_idx = 0; image_idx < NUM_IMAGES; image_idx = image_idx + 1) begin
            // The controller must be idle before replacing the image.
            wait (busy === 1'b0);
            wait (done === 1'b0);

            // Load one packed 28x28 image into Image BRAM.
            for (i = 0; i < WORDS_PER_IMAGE; i = i + 1) begin
                @(negedge clk);
                image_we    = 1'b1;
                image_waddr = i[7:0];
                image_wdata = all_image_words[
                    image_idx * WORDS_PER_IMAGE + i
                ];
            end

            @(negedge clk);
            image_we = 1'b0;

            // Save the cumulative cycle count immediately before start.
            cycles_before_image = global_busy_cycles;

            // Start one inference with a one-clock pulse.
            @(negedge clk);
            start = 1'b1;

            @(negedge clk);
            start = 1'b0;

            // Wait for the one-clock done state.
            wait (done === 1'b1);
            #1;

            image_busy_cycles = global_busy_cycles - cycles_before_image;

            if (image_busy_cycles < min_busy_cycles)
                min_busy_cycles = image_busy_cycles;

            if (image_busy_cycles > max_busy_cycles)
                max_busy_cycles = image_busy_cycles;

            // ----------------------------------------------------------
            // Argmax over the ten ReLU-applied FC outputs
            // ----------------------------------------------------------
            prediction = 0;

            // Detect X/Z before doing signed comparisons.
            if (^logits_flat[0 +: 32] === 1'bx) begin
                $display("ERROR image[%0d]: logit[0] contains X/Z", image_idx);
                unknown_logit_count = unknown_logit_count + 1;
                best_value = 32'sh8000_0000;
            end else begin
                best_value = $signed(logits_flat[0 +: 32]);
            end

            for (i = 1; i < NUM_CLASSES; i = i + 1) begin
                if (^logits_flat[i*32 +: 32] === 1'bx) begin
                    $display(
                        "ERROR image[%0d]: logit[%0d] contains X/Z",
                        image_idx,
                        i
                    );
                    unknown_logit_count = unknown_logit_count + 1;
                end else begin
                    current_value = $signed(logits_flat[i*32 +: 32]);

                    if (current_value > best_value) begin
                        best_value = current_value;
                        prediction = i;
                    end
                end
            end

            // ----------------------------------------------------------
            // Accuracy accumulation
            // ----------------------------------------------------------
            if (prediction == labels[image_idx]) begin
                correct_count = correct_count + 1;
            end else begin
                wrong_count = wrong_count + 1;
                $display(
                    "MISCLASSIFIED image[%0d]: RTL=%0d, LABEL=%0d, cycles=%0d",
                    image_idx,
                    prediction,
                    labels[image_idx],
                    image_busy_cycles
                );
            end

            // Progress report every 100 images.
            if (((image_idx + 1) % 100) == 0) begin
                $display(
                    "Progress %0d/%0d: correct=%0d, wrong=%0d, running_acc=%0.2f%%",
                    image_idx + 1,
                    NUM_IMAGES,
                    correct_count,
                    wrong_count,
                    (100.0 * correct_count) / (image_idx + 1)
                );
            end

            // ST_DONE automatically returns to ST_IDLE on the next clock.
            wait (done === 1'b0);
        end

        dataset_end_time = $time;

        // --------------------------------------------------------------
        // Final statistics
        // --------------------------------------------------------------
        accuracy_percent       = (100.0 * correct_count) / NUM_IMAGES;
        total_pl_time_ms       = (global_busy_cycles * CLK_PERIOD_NS) / 1000000.0;
        average_pl_time_us     = (global_busy_cycles * CLK_PERIOD_NS)
                               / (NUM_IMAGES * 1000.0);
        dataset_modeled_time_ms = (dataset_end_time - dataset_start_time)
                                / 1000000.0;
        total_modeled_time_ms   = (dataset_end_time - benchmark_start_time)
                                / 1000000.0;

        $display("");
        $display("============================================================");
        $display("FINAL DATASET RESULT");
        $display("============================================================");
        $display("Correct                    : %0d / %0d", correct_count, NUM_IMAGES);
        $display("Wrong                      : %0d", wrong_count);
        $display("Classification accuracy    : %0.2f%%", accuracy_percent);
        $display("Unknown/X/Z logits         : %0d", unknown_logit_count);
        $display("Overflow observed          : %0d", overflow_seen_any);
        $display("");
        $display("Total PL busy cycles       : %0d", global_busy_cycles);
        $display("Average PL cycles/image    : %0.2f",
                 (1.0 * global_busy_cycles) / NUM_IMAGES);
        $display("Minimum PL cycles/image    : %0d", min_busy_cycles);
        $display("Maximum PL cycles/image    : %0d", max_busy_cycles);
        $display("Pure PL compute time       : %0.3f ms", total_pl_time_ms);
        $display("Average PL latency/image   : %0.3f us", average_pl_time_us);
        $display("");
        $display("Weight-loading modeled time: %0.3f us",
                 (weight_load_end_time - benchmark_start_time) / 1000.0);
        $display("Dataset modeled time       : %0.3f ms", dataset_modeled_time_ms);
        $display("Total modeled time         : %0.3f ms", total_modeled_time_ms);
        $display("============================================================");

        if (unknown_logit_count != 0) begin
            $display("TEST FAILED: output contains X/Z values");
        end else if (overflow_seen_any) begin
            $display("TEST FAILED: int32 overflow was observed");
        end else begin
            $display("TEST COMPLETED");
        end

        $finish;
    end

    // ------------------------------------------------------------------
    // Timeout
    // 1000 single-MAC inferences can represent several seconds of
    // simulated design time. This is modeled time, not PC wall-clock time.
    // ------------------------------------------------------------------
    initial begin
        #(TIMEOUT_NS);
        $display(
            "FATAL: simulation timeout at t=%0t ns, image=%0d, state=%0d, busy=%0b, done=%0b",
            $time,
            image_idx,
            debug_state,
            busy,
            done
        );
        $finish;
    end

endmodule

```



lenet_baseline_top 모듈이 1,000장의 MNIST 이미지를 정상적으로 분류하는지 검증하는 Testbench임.

주요 역할은 다음과 같음.

- Clock과 Reset 신호 생성
- Weight 데이터 파일 읽기
- 1,000장의 이미지 데이터 읽기
- DUT 내부 BRAM에 Weight와 이미지 적재
- 이미지별 추론 시작
- 완료 신호 대기
- 10개 Logit에서 Argmax 수행
- 정답 Label과 비교
- 정확도와 처리 Cycle 측정
- X/Z 출력과 Overflow 검사

전체 흐름은 다음과 같음.

Weight 파일 적재

→ Weight BRAM에 Weight 805개 저장

→ 이미지 한 장을 Image BRAM에 저장

→ start 신호 발생

→ PL 추론 완료 대기

→ 10개 Logit 비교

→ 예측 결과와 Label 비교

→ 다음 이미지 처리

→ 1,000장 처리 후 최종 통계 출력

---

<h5 class="lenet-original-heading">Testbench 설정</h5>

Testbench는 다음과 같은 상수를 사용함.



```verilog
localparam integer NUM_IMAGES        = 1000;
localparam integer WORDS_PER_IMAGE   = 196;
localparam integer WEIGHT_WORDS      = 805;
localparam integer NUM_CLASSES       = 10;
localparam integer CLK_PERIOD_NS     = 10;
```



- 처리할 이미지 수: 1,000장
- 이미지 한 장의 BRAM Word 수: 196개
- 전체 Weight BRAM Word 수: 805개
- 출력 Class 수: 10개
- Clock 주기: 10ns
- Clock 주파수: 100MHz

이미지 한 장은 28 × 28, 총 784개의 8bit Pixel로 구성됨.

32bit Word 하나에 Pixel 4개를 저장하므로 이미지 한 장에는 196개의 Word가 필요함.

---

<h5 class="lenet-original-heading">DUT 연결</h5>

검증 대상인 lenet_baseline_top을 Testbench 내부에 연결함.



```verilog
lenet_baseline_top dut (
    .clk            (clk),
    .rst_n          (rst_n),
    .start          (start),
    .busy           (busy),
    .done           (done),
    .overflow_error (overflow_error),
    .debug_state    (debug_state),
    .image_we       (image_we),
    .image_waddr    (image_waddr),
    .image_wdata    (image_wdata),
    .weight_we      (weight_we),
    .weight_waddr   (weight_waddr),
    .weight_wdata   (weight_wdata),
    .logits_flat    (logits_flat)
);
```



Testbench는 image_we와 weight_we를 통해 DUT 내부의 Image BRAM과 Weight BRAM에 데이터를 직접 기록함.

추론 결과는 10개의 32bit Logit이 결합된 320bit logits_flat 신호로 전달받음.

---

<h5 class="lenet-original-heading">Clock 생성</h5>

100MHz Clock을 생성함.



```verilog
initial begin
    clk = 1'b0;
    forever #(CLK_PERIOD_NS/2) clk = ~clk;
end
```



Clock은 5ns마다 반전되므로 전체 주기는 10ns임.

---

<h5 class="lenet-original-heading">테스트 데이터 파일 읽기</h5>

다음 세 개의 HEX 파일을 Testbench 배열로 읽음.



```verilog
initial begin
    $readmemh("weight_words.hex", weight_words);
    $readmemh("all_image_words.hex", all_image_words);
    $readmemh("labels.hex", labels);
end
```



| 파일 | 내용 |
| --- | --- |
| weight_words.hex | CONV1, CONV2, FC Weight |
| all_image_words.hex | 1,000장의 입력 이미지 |
| labels.hex | 각 이미지의 정답 Label |

all_image_words에는 이미지별로 196개의 Word가 연속 저장됨.

이미지 n의 첫 번째 Word 위치는 다음과 같음.

이미지 시작 위치 = n × 196

- Hex file 생성 코드



```python
#!/usr/bin/env python3
"""Generate 1000-image packed hex files for tb_lenet_baseline_1000.v."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np

BASE_DIR = Path(__file__).resolve().parent
BASELINE_PATH = BASE_DIR / "lenet_inference_pdf_baseline.py"
OUTPUT_DIR = BASE_DIR / "vectors_1000"

def load_baseline(path: Path):
    spec = importlib.util.spec_from_file_location("lenet_baseline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import baseline: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module

def pack_u8_words(values: np.ndarray) -> np.ndarray:
    flat = np.asarray(values, dtype=np.uint8).reshape(-1)
    if flat.size % 4 != 0:
        raise ValueError(f"Byte count must be divisible by 4, got {flat.size}")

    words = np.zeros(flat.size // 4, dtype=np.uint32)
    words |= flat[0::4].astype(np.uint32)
    words |= flat[1::4].astype(np.uint32) << 8
    words |= flat[2::4].astype(np.uint32) << 16
    words |= flat[3::4].astype(np.uint32) << 24
    return words

def write_hex32(path: Path, values: np.ndarray) -> None:
    flat = np.asarray(values).reshape(-1)
    with path.open("w", encoding="ascii", newline="\n") as f:
        for value in flat:
            f.write(f"{int(value) & 0xFFFFFFFF:08x}\n")

def write_hex8(path: Path, values: np.ndarray) -> None:
    flat = np.asarray(values).reshape(-1)
    with path.open("w", encoding="ascii", newline="\n") as f:
        for value in flat:
            f.write(f"{int(value) & 0xFF:02x}\n")

def main() -> None:
    if not BASELINE_PATH.exists():
        raise FileNotFoundError(
            f"Place this script beside lenet_inference_pdf_baseline.py: {BASELINE_PATH}"
        )

    baseline = load_baseline(BASELINE_PATH)

    if baseline.num_images < 1000:
        raise ValueError(f"Need at least 1000 images, found {baseline.num_images}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Preserve the exact C-order used by the Python baseline:
    # image 0's 784 bytes, then image 1's 784 bytes, and so on.
    images_1000 = baseline.images[:1000]
    labels_1000 = baseline.labels[:1000]

    all_weights = np.concatenate(
        [
            baseline.conv1_w.reshape(-1),
            baseline.conv2_w.reshape(-1),
            baseline.fc1_w.reshape(-1),
        ]
    ).astype(np.int8, copy=False).view(np.uint8)

    packed_weights = pack_u8_words(all_weights)
    packed_images = pack_u8_words(images_1000.reshape(-1))

    if packed_weights.size != 805:
        raise RuntimeError(f"Expected 805 weight words, got {packed_weights.size}")

    if packed_images.size != 1000 * 196:
        raise RuntimeError(
            f"Expected {1000 * 196} image words, got {packed_images.size}"
        )

    write_hex32(OUTPUT_DIR / "weight_words.hex", packed_weights)
    write_hex32(OUTPUT_DIR / "all_image_words.hex", packed_images)
    write_hex8(OUTPUT_DIR / "labels.hex", labels_1000)

    print(f"Generated: {OUTPUT_DIR / 'weight_words.hex'} ({packed_weights.size} lines)")
    print(f"Generated: {OUTPUT_DIR / 'all_image_words.hex'} ({packed_images.size} lines)")
    print(f"Generated: {OUTPUT_DIR / 'labels.hex'} ({labels_1000.size} lines)")

if __name__ == "__main__":
    main()

```




---

<h5 class="lenet-original-heading">Reset 처리</h5>

Simulation 시작 시 Reset을 0으로 설정한 뒤 5 Clock 동안 유지함.



```verilog
repeat (5) @(posedge clk);

@(negedge clk);
rst_n = 1'b1;
```



Reset 해제 이후 Weight 적재와 이미지 추론을 시작함.

---

<h5 class="lenet-original-heading">Weight 적재</h5>

Weight는 전체 Dataset 처리 전에 한 번만 Weight BRAM에 저장함.



```verilog
for (i = 0; i < WEIGHT_WORDS; i = i + 1) begin
    @(negedge clk);
    weight_we    = 1'b1;
    weight_waddr = i[9:0];
    weight_wdata = weight_words[i];
end
```



805개의 32bit Weight Word를 주소 0부터 804까지 순서대로 기록함.

모든 이미지는 동일한 Weight를 사용하므로 이미지마다 Weight를 다시 적재하지 않음.

---

<h5 class="lenet-original-heading">이미지 적재</h5>

이미지 한 장을 처리하기 전에 Image BRAM에 196개의 Word를 기록함.



```verilog
for (i = 0; i < WORDS_PER_IMAGE; i = i + 1) begin
    @(negedge clk);
    image_we    = 1'b1;
    image_waddr = i[7:0];
    image_wdata =
        all_image_words[image_idx * WORDS_PER_IMAGE + i];
end
```



image_idx가 변경될 때마다 all_image_words의 다음 196개 Word를 Image BRAM 주소 0부터 195까지 덮어씀.

이미지는 한 번에 한 장만 Image BRAM에 저장됨.

---

<h5 class="lenet-original-heading">추론 시작</h5>

이미지 적재가 끝나면 start 신호를 한 Clock 동안 활성화함.



```verilog
@(negedge clk);
start = 1'b1;

@(negedge clk);
start = 1'b0;
```



이 신호를 받은 lenet_baseline_top은 다음 순서로 추론을 수행함.

CONV1 → ReLU1 → POOL1 → CONV2 → ReLU2 → POOL2 → FC → ReLU10

Testbench는 done이 1이 될 때까지 기다림.



```verilog
wait (done === 1'b1);
```



---

<h5 class="lenet-original-heading">PL Cycle 측정</h5>

global_busy_cycles는 DUT의 busy 신호가 1인 Clock만 계산함.



```verilog
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        global_busy_cycles <= 64'd0;
    else if (busy)
        global_busy_cycles <= global_busy_cycles + 64'd1;
end
```



순수하게 PL이 추론을 수행하는 동안의 Cycle만 측정함.

이미지 한 장의 처리 Cycle은 추론 전후의 누적 Cycle 차이로 계산함.



```verilog
cycles_before_image = global_busy_cycles;

wait (done === 1'b1);

image_busy_cycles =
    global_busy_cycles - cycles_before_image;
```



---

<h5 class="lenet-original-heading">X/Z 값 검사</h5>

Argmax를 수행하기 전에 각 Logit에 X 또는 Z가 포함되어 있는지 검사함.



```verilog
if (^logits_flat[i*32 +: 32] === 1'bx) begin
    unknown_logit_count = unknown_logit_count + 1;
end
```



Reduction XOR 결과가 X이면 해당 32bit Logit 내부에 X 또는 Z가 존재한다는 의미임.

이 검사를 통해 BRAM 초기화 실패, 주소 오류, 미연결 신호 등의 문제를 감지할 수 있음.

---

<h5 class="lenet-original-heading">Argmax 수행</h5>

10개의 ReLU 적용 Logit 중 가장 큰 값을 가진 Class를 예측 결과로 선택함.



```verilog
prediction = 0;
best_value = $signed(logits_flat[0 +: 32]);

for (i = 1; i < NUM_CLASSES; i = i + 1) begin
    current_value =
        $signed(logits_flat[i*32 +: 32]);

    if (current_value > best_value) begin
        best_value = current_value;
        prediction = i;
    end
end
```



예를 들어 Class 7의 Logit이 가장 크다면 prediction은 7이 됨.

이 Argmax는 DUT 내부에서 수행하는 것이 아니라 Testbench에서 결과 검증을 위해 수행함.

---

<h5 class="lenet-original-heading">정답 비교</h5>

예측 결과와 labels.hex에서 읽은 정답을 비교함.



```verilog
if (prediction == labels[image_idx]) begin
    correct_count = correct_count + 1;
end
else begin
    wrong_count = wrong_count + 1;
end
```



틀린 이미지에 대해서는 다음 정보를 출력함.

- 이미지 번호
- RTL 예측값
- 실제 Label
- 해당 이미지의 PL 처리 Cycle

100장마다 현재 정확도를 출력함.

---

<h5 class="lenet-original-heading">Overflow 검사</h5>

DUT에서 overflow_error가 한 번이라도 발생하면 overflow_seen_any를 1로 유지함.



```verilog
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        overflow_seen_any <= 1'b0;
    else if (overflow_error)
        overflow_seen_any <= 1'b1;
end
```



현재 이미지뿐만 아니라 1,000장 전체 처리 중 발생한 Overflow를 기록하는 Sticky Flag임.

---

<h5 class="lenet-original-heading">최종 결과 출력</h5>

1,000장의 처리가 완료되면 다음 통계를 출력함.

- 정답 개수
- 오답 개수
- 분류 정확도
- X/Z Logit 개수
- Overflow 발생 여부
- 전체 PL Busy Cycle
- 이미지당 평균 Cycle
- 최소 및 최대 Cycle
- 순수 PL 연산 시간
- 이미지당 평균 Latency
- Weight 적재 시간
- 전체 Simulation 시간

정확도는 다음과 같이 계산함.

분류 정확도 = 정답 이미지 수 ÷ 1,000 × 100

100MHz Clock에서는 1 Cycle이 10ns이므로 PL 연산 시간은 Busy Cycle에 10ns를 곱해 계산함.

---

<h5 class="lenet-original-heading">Timeout 처리</h5>

Simulation이 비정상적으로 멈추는 상황을 방지하기 위해 30초의 Modeling Time Timeout을 설정함.



```verilog
initial begin
    #(TIMEOUT_NS);

    $display(
        "FATAL: simulation timeout at t=%0t ns, image=%0d, state=%0d, busy=%0b, done=%0b",
        $time,
        image_idx,
        debug_state,
        busy,
        done
    );

    $finish;
end
```



Timeout이 발생하면 다음 정보를 출력함.

- 현재 Simulation 시간
- 처리 중인 이미지 번호
- Controller의 debug_state
- busy 상태
- done 상태

이를 통해 어느 단계에서 Simulation이 정지했는지 확인할 수 있음.

---

<h4 class="lenet-original-heading">PL Timer</h4>

<h5 class="lenet-original-heading">pl_cycle_timer.v</h5>



```verilog
`timescale 1ns/1ps

// Counts only the cycles for which accelerator_busy is asserted.
// The completed count is latched when accelerator_done pulses high.
module pl_cycle_timer (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    input  wire        accelerator_busy,
    input  wire        accelerator_done,

    output reg  [63:0] cycle_count,
    output reg  [63:0] live_cycle_count
);
    reg measuring;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cycle_count      <= 64'd0;
            live_cycle_count <= 64'd0;
            measuring        <= 1'b0;
        end else begin
            // A new inference starts. Keep the previous completed result in
            // cycle_count until the new inference finishes.
            if (start && !accelerator_busy) begin
                live_cycle_count <= 64'd0;
                measuring        <= 1'b1;
            end else if (measuring && accelerator_busy) begin
                live_cycle_count <= live_cycle_count + 64'd1;
            end

            // In the current controller, done is asserted during ST_DONE,
            // one clock after the final busy cycle. Therefore no +1 is needed.
            if (measuring && accelerator_done) begin
                cycle_count <= live_cycle_count;
                measuring   <= 1'b0;
            end
        end
    end
endmodule

```



PL용 타이머 모듈을 추가했음. 그래서 Top module 맨 아래에 다음 코드 추가필요

- 추가 코드



```verilog
 // PL-only inference cycle timer. This matches the testbench definition:
    // count every clock for which the controller-level busy signal is high.
    wire [63:0] live_cycle_count_unused;

    pl_cycle_timer u_pl_cycle_timer (
        .clk              (clk),
        .rst_n            (rst_n),
        .start            (start),
        .accelerator_busy (busy),
        .accelerator_done (done),
        .cycle_count      (cycle_count),
        .live_cycle_count (live_cycle_count_unused)
    );

```




<h3 class="lenet-original-heading">PL Result</h3>



```bash
============================================================
LeNet RTL dataset test start
Images             : 1000
Clock              : 100 MHz
Weight words loaded: 805
============================================================
MISCLASSIFIED image[20]: RTL=8, LABEL=1, cycles=434330
MISCLASSIFIED image[59]: RTL=1, LABEL=2, cycles=434330
MISCLASSIFIED image[61]: RTL=9, LABEL=4, cycles=434330
MISCLASSIFIED image[94]: RTL=8, LABEL=2, cycles=434330
Progress 100/1000: correct=96, wrong=4, running_acc=96.00%
MISCLASSIFIED image[110]: RTL=9, LABEL=7, cycles=434330
MISCLASSIFIED image[128]: RTL=8, LABEL=1, cycles=434330
Progress 200/1000: correct=194, wrong=6, running_acc=97.00%
MISCLASSIFIED image[246]: RTL=5, LABEL=3, cycles=434330
MISCLASSIFIED image[273]: RTL=9, LABEL=0, cycles=434330
MISCLASSIFIED image[278]: RTL=4, LABEL=0, cycles=434330
MISCLASSIFIED image[287]: RTL=0, LABEL=6, cycles=434330
Progress 300/1000: correct=290, wrong=10, running_acc=96.67%
MISCLASSIFIED image[316]: RTL=2, LABEL=7, cycles=434330
Progress 400/1000: correct=389, wrong=11, running_acc=97.25%
Progress 500/1000: correct=489, wrong=11, running_acc=97.80%
MISCLASSIFIED image[508]: RTL=5, LABEL=3, cycles=434330
MISCLASSIFIED image[520]: RTL=9, LABEL=4, cycles=434330
MISCLASSIFIED image[527]: RTL=9, LABEL=4, cycles=434330
Progress 600/1000: correct=586, wrong=14, running_acc=97.67%
Progress 700/1000: correct=686, wrong=14, running_acc=98.00%
Progress 800/1000: correct=786, wrong=14, running_acc=98.25%
Progress 900/1000: correct=886, wrong=14, running_acc=98.44%
Progress 1000/1000: correct=986, wrong=14, running_acc=98.60%

============================================================
FINAL DATASET RESULT
============================================================
Correct                    : 986 / 1000
Wrong                      : 14
Classification accuracy    : 98.60%
Unknown/X/Z logits         : 0
Overflow observed          : 0

Total PL busy cycles       : 434330000
Average PL cycles/image    : 434330.00
Minimum PL cycles/image    : 434330
Maximum PL cycles/image    : 434330
Pure PL compute time       : 4343.300 ms
Average PL latency/image   : 4343.300 us

Weight-loading modeled time: 8.060 us
Dataset modeled time       : 4345.290 ms
Total modeled time         : 4345.298 ms
============================================================
TEST COMPLETED
```



Python에서 simulation을 돌린 결과와 accuracy와 틀린 개수가 정확히 일치하는 것을 볼 수 있음.

<h4 class="lenet-original-heading">AXI4-Lite CSR Wrapper</h4>

- 만드는 과정


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-09.png"><img src="/assets/images/lenet-project-2026/baseline-09.png" alt="BASELINE 원본 그림 9 · AXI4-Lite CSR Wrapper" width="1362" height="633" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 9 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

Create a new AXI4 Peripheral 선택


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-10.png"><img src="/assets/images/lenet-project-2026/baseline-10.png" alt="BASELINE 원본 그림 10 · AXI4-Lite CSR Wrapper" width="842" height="570" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 10 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-11.png"><img src="/assets/images/lenet-project-2026/baseline-11.png" alt="BASELINE 원본 그림 11 · AXI4-Lite CSR Wrapper" width="840" height="571" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 11 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-12.png"><img src="/assets/images/lenet-project-2026/baseline-12.png" alt="BASELINE 원본 그림 12 · AXI4-Lite CSR Wrapper" width="841" height="564" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 12 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

16비트로 바꾸는 이유는 다음과 같음.

| 번호 | Offset | 용도 |
| --- | --- | --- |
| 0 | 0x00 | CONTROL, START |
| 1 | 0x04 | STATUS, BUSY/DONE/OVERFLOW |
| 2 | 0x08 | DEBUG_STATE |
| 3 | 0x0C | Reserved 또는 Version |
| 4 | 0x10 | LOGIT0 |
| 5 | 0x14 | LOGIT1 |
| 6 | 0x18 | LOGIT2 |
| 7 | 0x1C | LOGIT3 |
| 8 | 0x20 | LOGIT4 |
| 9 | 0x24 | LOGIT5 |
| 10 | 0x28 | LOGIT6 |
| 11 | 0x2C | LOGIT7 |
| 12 | 0x30 | LOGIT8 |
| 13 | 0x34 | LOGIT9 |
| 14 | 0x38 | CYCLE_LOW |
| 15 | 0x3C | CYCLE_HIGH |

---

Edit IP 체크


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-13.png"><img src="/assets/images/lenet-project-2026/baseline-13.png" alt="BASELINE 원본 그림 13 · AXI4-Lite CSR Wrapper" width="841" height="570" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 13 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-14.png"><img src="/assets/images/lenet-project-2026/baseline-14.png" alt="BASELINE 원본 그림 14 · AXI4-Lite CSR Wrapper" width="795" height="655" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 14 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

csr.v과 csr_slave_lite_v1_0_S00_AXI.v 수정

- csr.v



```verilog
`timescale 1 ns / 1 ps

module csr #
(
    parameter integer C_S00_AXI_DATA_WIDTH = 32,
    parameter integer C_S00_AXI_ADDR_WIDTH = 6
)
(
    // LeNet control/status interface
    output wire         start_pulse,

    input  wire         lenet_core_rst_n,
    input  wire         lenet_busy,
    input  wire         lenet_done,
    input  wire         lenet_overflow,
    input  wire [4:0]   lenet_debug_state,
    input  wire [319:0] lenet_logits_flat,
    input  wire [63:0]  lenet_cycle_count,

    // AXI4-Lite Slave Interface
    input  wire                                  s00_axi_aclk,
    input  wire                                  s00_axi_aresetn,

    input  wire [C_S00_AXI_ADDR_WIDTH-1:0]       s00_axi_awaddr,
    input  wire [2:0]                            s00_axi_awprot,
    input  wire                                  s00_axi_awvalid,
    output wire                                  s00_axi_awready,

    input  wire [C_S00_AXI_DATA_WIDTH-1:0]       s00_axi_wdata,
    input  wire [(C_S00_AXI_DATA_WIDTH/8)-1:0]   s00_axi_wstrb,
    input  wire                                  s00_axi_wvalid,
    output wire                                  s00_axi_wready,

    output wire [1:0]                            s00_axi_bresp,
    output wire                                  s00_axi_bvalid,
    input  wire                                  s00_axi_bready,

    input  wire [C_S00_AXI_ADDR_WIDTH-1:0]       s00_axi_araddr,
    input  wire [2:0]                            s00_axi_arprot,
    input  wire                                  s00_axi_arvalid,
    output wire                                  s00_axi_arready,

    output wire [C_S00_AXI_DATA_WIDTH-1:0]       s00_axi_rdata,
    output wire [1:0]                            s00_axi_rresp,
    output wire                                  s00_axi_rvalid,
    input  wire                                  s00_axi_rready
);

    csr_slave_lite_v1_0_S00_AXI #(
        .C_S_AXI_DATA_WIDTH (C_S00_AXI_DATA_WIDTH),
        .C_S_AXI_ADDR_WIDTH (C_S00_AXI_ADDR_WIDTH)
    ) csr_slave_lite_v1_0_S00_AXI_inst (
        // LeNet interface
        .lenet_core_rst_n (lenet_core_rst_n),
        .start_pulse      (start_pulse),
        .lenet_busy       (lenet_busy),
        .lenet_done       (lenet_done),
        .lenet_overflow   (lenet_overflow),
        .lenet_debug_state(lenet_debug_state),
        .lenet_logits_flat(lenet_logits_flat),
        .lenet_cycle_count(lenet_cycle_count),

        // AXI interface
        .S_AXI_ACLK       (s00_axi_aclk),
        .S_AXI_ARESETN    (s00_axi_aresetn),

        .S_AXI_AWADDR     (s00_axi_awaddr),
        .S_AXI_AWPROT     (s00_axi_awprot),
        .S_AXI_AWVALID    (s00_axi_awvalid),
        .S_AXI_AWREADY    (s00_axi_awready),

        .S_AXI_WDATA      (s00_axi_wdata),
        .S_AXI_WSTRB      (s00_axi_wstrb),
        .S_AXI_WVALID     (s00_axi_wvalid),
        .S_AXI_WREADY     (s00_axi_wready),

        .S_AXI_BRESP      (s00_axi_bresp),
        .S_AXI_BVALID     (s00_axi_bvalid),
        .S_AXI_BREADY     (s00_axi_bready),

        .S_AXI_ARADDR     (s00_axi_araddr),
        .S_AXI_ARPROT     (s00_axi_arprot),
        .S_AXI_ARVALID    (s00_axi_arvalid),
        .S_AXI_ARREADY    (s00_axi_arready),

        .S_AXI_RDATA      (s00_axi_rdata),
        .S_AXI_RRESP      (s00_axi_rresp),
        .S_AXI_RVALID     (s00_axi_rvalid),
        .S_AXI_RREADY     (s00_axi_rready)
    );

endmodule
```



- csr_slave_lite_v1_0_S00_AXI.v



```verilog
`timescale 1 ns / 1 ps

module csr_slave_lite_v1_0_S00_AXI #
(
    parameter integer C_S_AXI_DATA_WIDTH = 32,
    parameter integer C_S_AXI_ADDR_WIDTH = 6
)
(
    // ------------------------------------------------------------
    // LeNet control / status ports
    // ------------------------------------------------------------
    input  wire         lenet_core_rst_n,
    output reg          start_pulse,
    input  wire         lenet_busy,
    input  wire         lenet_done,
    input  wire         lenet_overflow,
    input  wire [4:0]   lenet_debug_state,
    input  wire [319:0] lenet_logits_flat,
    input  wire [63:0]  lenet_cycle_count,

    // ------------------------------------------------------------
    // AXI4-Lite slave interface
    // ------------------------------------------------------------
    input  wire                                  S_AXI_ACLK,
    input  wire                                  S_AXI_ARESETN,

    input  wire [C_S_AXI_ADDR_WIDTH-1:0]         S_AXI_AWADDR,
    input  wire [2:0]                            S_AXI_AWPROT,
    input  wire                                  S_AXI_AWVALID,
    output wire                                  S_AXI_AWREADY,

    input  wire [C_S_AXI_DATA_WIDTH-1:0]         S_AXI_WDATA,
    input  wire [(C_S_AXI_DATA_WIDTH/8)-1:0]     S_AXI_WSTRB,
    input  wire                                  S_AXI_WVALID,
    output wire                                  S_AXI_WREADY,

    output wire [1:0]                            S_AXI_BRESP,
    output wire                                  S_AXI_BVALID,
    input  wire                                  S_AXI_BREADY,

    input  wire [C_S_AXI_ADDR_WIDTH-1:0]         S_AXI_ARADDR,
    input  wire [2:0]                            S_AXI_ARPROT,
    input  wire                                  S_AXI_ARVALID,
    output wire                                  S_AXI_ARREADY,

    output wire [C_S_AXI_DATA_WIDTH-1:0]         S_AXI_RDATA,
    output wire [1:0]                            S_AXI_RRESP,
    output wire                                  S_AXI_RVALID,
    input  wire                                  S_AXI_RREADY
);

    // 32bit Register 간격
    // 0x00, 0x04, 0x08, ... , 0x3C
    localparam integer ADDR_LSB = 2;

    // ------------------------------------------------------------
    // AXI Write Channel
    //
    // AXI의 Write Address와 Write Data는 서로 다른 Clock에
    // 들어올 수 있으므로 각각 임시 Register에 저장함.
    // ------------------------------------------------------------
    reg [C_S_AXI_ADDR_WIDTH-1:0]     awaddr_hold;
    reg                              awaddr_hold_valid;

    reg [C_S_AXI_DATA_WIDTH-1:0]     wdata_hold;
    reg [(C_S_AXI_DATA_WIDTH/8)-1:0] wstrb_hold;
    reg                              wdata_hold_valid;

    reg                              bvalid_reg;

    wire aw_accept;
    wire w_accept;
    wire write_commit;
    wire [3:0] write_reg_index;
    wire start_write_fire;

    // 이전 주소 또는 데이터가 저장되어 있지 않고
    // Write Response를 기다리는 중이 아닐 때 새로운 요청을 받음.
    assign S_AXI_AWREADY =
        !awaddr_hold_valid && !bvalid_reg;

    assign S_AXI_WREADY =
        !wdata_hold_valid && !bvalid_reg;

    assign aw_accept =
        S_AXI_AWVALID && S_AXI_AWREADY;

    assign w_accept =
        S_AXI_WVALID && S_AXI_WREADY;

    // Address와 Data가 모두 저장되면 하나의 Write Transaction 완료
    assign write_commit =
        awaddr_hold_valid &&
        wdata_hold_valid &&
        !bvalid_reg;

    // 주소 bit 5:2를 사용하여 16개 CSR 중 하나를 선택함.
    assign write_reg_index =
        awaddr_hold[ADDR_LSB+3:ADDR_LSB];

    // CONTROL Register
    // Offset 0x00의 bit 0에 1을 쓰면 START Pulse 생성
    //
    // 다음 상황에서는 START를 발생시키지 않음.
    // 1. LeNet이 이미 busy인 경우
    // 2. LeNet Core가 Reset 상태인 경우
    assign start_write_fire =
        write_commit             &&
        (write_reg_index == 4'h0) &&
        wstrb_hold[0]             &&
        wdata_hold[0]             &&
        !lenet_busy               &&
        lenet_core_rst_n;

    assign S_AXI_BVALID = bvalid_reg;
    assign S_AXI_BRESP  = 2'b00;

    always @(posedge S_AXI_ACLK) begin
        if (!S_AXI_ARESETN) begin
            awaddr_hold       <= {C_S_AXI_ADDR_WIDTH{1'b0}};
            awaddr_hold_valid <= 1'b0;

            wdata_hold        <= {C_S_AXI_DATA_WIDTH{1'b0}};
            wstrb_hold        <= {(C_S_AXI_DATA_WIDTH/8){1'b0}};
            wdata_hold_valid  <= 1'b0;

            bvalid_reg        <= 1'b0;
        end
        else begin
            // Write Address 저장
            if (aw_accept) begin
                awaddr_hold       <= S_AXI_AWADDR;
                awaddr_hold_valid <= 1'b1;
            end

            // Write Data와 Byte Strobe 저장
            if (w_accept) begin
                wdata_hold       <= S_AXI_WDATA;
                wstrb_hold       <= S_AXI_WSTRB;
                wdata_hold_valid <= 1'b1;
            end

            // Address와 Data가 모두 준비되면 Write 완료 응답 생성
            if (write_commit) begin
                awaddr_hold_valid <= 1'b0;
                wdata_hold_valid  <= 1'b0;
                bvalid_reg        <= 1'b1;
            end

            // Master가 Write Response를 받으면 BVALID 해제
            if (bvalid_reg && S_AXI_BREADY)
                bvalid_reg <= 1'b0;
        end
    end

    // ------------------------------------------------------------
    // START Pulse 및 Sticky Status
    // ------------------------------------------------------------
    reg done_sticky;
    reg overflow_sticky;

    always @(posedge S_AXI_ACLK) begin
        if (!S_AXI_ARESETN) begin
            start_pulse     <= 1'b0;
            done_sticky     <= 1'b0;
            overflow_sticky <= 1'b0;
        end
        else begin
            // START는 기본적으로 0이며 한 Clock만 1이 됨.
            start_pulse <= 1'b0;

            // LeNet Core가 Reset되면 이전 상태 삭제
            if (!lenet_core_rst_n) begin
                done_sticky     <= 1'b0;
                overflow_sticky <= 1'b0;
            end

            // 새로운 추론을 시작하면 이전 완료 및 오류 상태 삭제
            else if (start_write_fire) begin
                start_pulse     <= 1'b1;
                done_sticky     <= 1'b0;
                overflow_sticky <= 1'b0;
            end

            // LeNet의 짧은 Pulse를 CSR 내부에 저장
            else begin
                if (lenet_done)
                    done_sticky <= 1'b1;

                if (lenet_overflow)
                    overflow_sticky <= 1'b1;
            end
        end
    end

    // ------------------------------------------------------------
    // CSR Read Data 선택
    //
    // 0x00 CONTROL
    // 0x04 STATUS
    // 0x08 DEBUG
    // 0x0C VERSION
    // 0x10 ~ 0x34 LOGIT0 ~ LOGIT9
    // 0x38 CYCLE_LOW
    // 0x3C CYCLE_HIGH
    // ------------------------------------------------------------
    function [C_S_AXI_DATA_WIDTH-1:0] csr_read_data;
        input [3:0] reg_index;

        begin
            case (reg_index)

                // 0x00 CONTROL
                // START는 Write Pulse이므로 Read 시 0 반환
                4'h0: begin
                    csr_read_data = 32'd0;
                end

                // 0x04 STATUS
                //
                // bit 0: BUSY
                // bit 1: DONE Sticky
                // bit 2: OVERFLOW Sticky
                // bit 3: LeNet Core Reset 해제 상태
                4'h1: begin
                    csr_read_data = {
                        28'd0,
                        lenet_core_rst_n,
                        overflow_sticky,
                        done_sticky,
                        lenet_busy
                    };
                end

                // 0x08 DEBUG
                // bit 4:0 Controller State
                4'h2: begin
                    csr_read_data = {
                        27'd0,
                        lenet_debug_state
                    };
                end

                // 0x0C VERSION
                // Major Version 1, Minor Version 0
                4'h3: begin
                    csr_read_data = 32'h0001_0000;
                end

                // 0x10 LOGIT0
                4'h4: begin
                    csr_read_data =
                        lenet_logits_flat[31:0];
                end

                // 0x14 LOGIT1
                4'h5: begin
                    csr_read_data =
                        lenet_logits_flat[63:32];
                end

                // 0x18 LOGIT2
                4'h6: begin
                    csr_read_data =
                        lenet_logits_flat[95:64];
                end

                // 0x1C LOGIT3
                4'h7: begin
                    csr_read_data =
                        lenet_logits_flat[127:96];
                end

                // 0x20 LOGIT4
                4'h8: begin
                    csr_read_data =
                        lenet_logits_flat[159:128];
                end

                // 0x24 LOGIT5
                4'h9: begin
                    csr_read_data =
                        lenet_logits_flat[191:160];
                end

                // 0x28 LOGIT6
                4'hA: begin
                    csr_read_data =
                        lenet_logits_flat[223:192];
                end

                // 0x2C LOGIT7
                4'hB: begin
                    csr_read_data =
                        lenet_logits_flat[255:224];
                end

                // 0x30 LOGIT8
                4'hC: begin
                    csr_read_data =
                        lenet_logits_flat[287:256];
                end

                // 0x34 LOGIT9
                4'hD: begin
                    csr_read_data =
                        lenet_logits_flat[319:288];
                end

                // 0x38 CYCLE_LOW
                4'hE: begin
                    csr_read_data =
                        lenet_cycle_count[31:0];
                end

                // 0x3C CYCLE_HIGH
                4'hF: begin
                    csr_read_data =
                        lenet_cycle_count[63:32];
                end

                default: begin
                    csr_read_data = 32'd0;
                end
            endcase
        end
    endfunction

    // ------------------------------------------------------------
    // AXI Read Channel
    // ------------------------------------------------------------
    reg [C_S_AXI_DATA_WIDTH-1:0] rdata_reg;
    reg                          rvalid_reg;

    wire ar_accept;
    wire [3:0] read_reg_index;

    // 이전 Read Data가 아직 처리되지 않은 경우
    // 새로운 Read Address를 받지 않음.
    assign S_AXI_ARREADY =
        !rvalid_reg;

    assign ar_accept =
        S_AXI_ARVALID && S_AXI_ARREADY;

    assign read_reg_index =
        S_AXI_ARADDR[ADDR_LSB+3:ADDR_LSB];

    assign S_AXI_RDATA  = rdata_reg;
    assign S_AXI_RVALID = rvalid_reg;
    assign S_AXI_RRESP  = 2'b00;

    always @(posedge S_AXI_ACLK) begin
        if (!S_AXI_ARESETN) begin
            rdata_reg  <= {C_S_AXI_DATA_WIDTH{1'b0}};
            rvalid_reg <= 1'b0;
        end
        else begin
            // Read Address를 받으면 해당 CSR 값을 저장
            if (ar_accept) begin
                rdata_reg  <= csr_read_data(read_reg_index);
                rvalid_reg <= 1'b1;
            end

            // Master가 Read Data를 받으면 RVALID 해제
            else if (rvalid_reg && S_AXI_RREADY) begin
                rvalid_reg <= 1'b0;
            end
        end
    end

    // AXI Protection 속성은 현재 CSR에서 사용하지 않음.
    wire unused_prot;

    assign unused_prot =
        ^S_AXI_AWPROT ^
        ^S_AXI_ARPROT;

endmodule
```





<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-15.png"><img src="/assets/images/lenet-project-2026/baseline-15.png" alt="BASELINE 원본 그림 15 · AXI4-Lite CSR Wrapper" width="2548" height="1372" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 15 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

Customization GUI 선택


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-16.png"><img src="/assets/images/lenet-project-2026/baseline-16.png" alt="BASELINE 원본 그림 16 · AXI4-Lite CSR Wrapper" width="1710" height="978" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 16 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

Merge 클릭


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-17.png"><img src="/assets/images/lenet-project-2026/baseline-17.png" alt="BASELINE 원본 그림 17 · AXI4-Lite CSR Wrapper" width="1503" height="985" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 17 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

그러면 이렇게 바뀜.


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-18.png"><img src="/assets/images/lenet-project-2026/baseline-18.png" alt="BASELINE 원본 그림 18 · AXI4-Lite CSR Wrapper" width="1717" height="976" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 18 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

Re-Package IP 클릭

- top module도 package


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-19.png"><img src="/assets/images/lenet-project-2026/baseline-19.png" alt="BASELINE 원본 그림 19 · AXI4-Lite CSR Wrapper" width="832" height="652" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 19 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-20.png"><img src="/assets/images/lenet-project-2026/baseline-20.png" alt="BASELINE 원본 그림 20 · AXI4-Lite CSR Wrapper" width="841" height="572" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 20 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>

이번엔 그냥 Package your current project


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-21.png"><img src="/assets/images/lenet-project-2026/baseline-21.png" alt="BASELINE 원본 그림 21 · AXI4-Lite CSR Wrapper" width="840" height="567" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 21 · AXI4-Lite CSR Wrapper · 클릭하면 원본 크기로 보기</figcaption></figure>


<h4 class="lenet-original-heading">Block Design</h4>

- 만드는 과정


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-22.png"><img src="/assets/images/lenet-project-2026/baseline-22.png" alt="BASELINE 원본 그림 22 · Block Design" width="2559" height="1389" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 22 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-23.png"><img src="/assets/images/lenet-project-2026/baseline-23.png" alt="BASELINE 원본 그림 23 · Block Design" width="864" height="761" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 23 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-24.png"><img src="/assets/images/lenet-project-2026/baseline-24.png" alt="BASELINE 원본 그림 24 · Block Design" width="863" height="771" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 24 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

ip 위치 추가해주면 이렇게 뜸 apply 하고 ok


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-25.png"><img src="/assets/images/lenet-project-2026/baseline-25.png" alt="BASELINE 원본 그림 25 · Block Design" width="1292" height="976" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 25 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

create Block Design 클릭


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-26.png"><img src="/assets/images/lenet-project-2026/baseline-26.png" alt="BASELINE 원본 그림 26 · Block Design" width="1862" height="923" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 26 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

Run Block Automation 클릭


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-27.png"><img src="/assets/images/lenet-project-2026/baseline-27.png" alt="BASELINE 원본 그림 27 · Block Design" width="628" height="262" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 27 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-28.png"><img src="/assets/images/lenet-project-2026/baseline-28.png" alt="BASELINE 원본 그림 28 · Block Design" width="582" height="582" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 28 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-29.png"><img src="/assets/images/lenet-project-2026/baseline-29.png" alt="BASELINE 원본 그림 29 · Block Design" width="500" height="608" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 29 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-30.png"><img src="/assets/images/lenet-project-2026/baseline-30.png" alt="BASELINE 원본 그림 30 · Block Design" width="1094" height="474" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 30 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

이렇게 연결함.

| CSR 포트 | LeNet 포트 | 방향 |
| --- | --- | --- |
| `start_pulse` | `start` | CSR → LeNet |
| `lenet_busy` | `busy` | LeNet → CSR |
| `lenet_done` | `done` | LeNet → CSR |
| `lenet_overflow` | `overflow_error` | LeNet → CSR |
| `lenet_debug_state[4:0]` | `debug_state[4:0]` | LeNet → CSR |
| `lenet_logits_flat[319:0]` | `logits_flat[319:0]` | LeNet → CSR |
| `lenet_cycle_count[63:0]` | `cycle_count[63:0]` | LeNet → CSR |


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-31.png"><img src="/assets/images/lenet-project-2026/baseline-31.png" alt="BASELINE 원본 그림 31 · Block Design" width="329" height="449" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 31 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-32.png"><img src="/assets/images/lenet-project-2026/baseline-32.png" alt="BASELINE 원본 그림 32 · Block Design" width="1033" height="783" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 32 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-33.png"><img src="/assets/images/lenet-project-2026/baseline-33.png" alt="BASELINE 원본 그림 33 · Block Design" width="949" height="907" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 33 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

이름을 BRAM이름으로 바꿔줌


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-34.png"><img src="/assets/images/lenet-project-2026/baseline-34.png" alt="BASELINE 원본 그림 34 · Block Design" width="1035" height="796" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 34 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-35.png"><img src="/assets/images/lenet-project-2026/baseline-35.png" alt="BASELINE 원본 그림 35 · Block Design" width="376" height="596" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 35 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

주소 크기를 맞춰서 넣어야함.


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-36.png"><img src="/assets/images/lenet-project-2026/baseline-36.png" alt="BASELINE 원본 그림 36 · Block Design" width="1034" height="779" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 36 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-37.png"><img src="/assets/images/lenet-project-2026/baseline-37.png" alt="BASELINE 원본 그림 37 · Block Design" width="1280" height="543" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 37 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

image bram은 read가 ps에서 일어날 필요가 없으므로 0으로 두면 됨


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-38.png"><img src="/assets/images/lenet-project-2026/baseline-38.png" alt="BASELINE 원본 그림 38 · Block Design" width="1153" height="447" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 38 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

image_we = bram_en_a AND OR(bram_we_a[3:0])가 돼야함.


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-39.png"><img src="/assets/images/lenet-project-2026/baseline-39.png" alt="BASELINE 원본 그림 39 · Block Design" width="1035" height="781" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 39 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-40.png"><img src="/assets/images/lenet-project-2026/baseline-40.png" alt="BASELINE 원본 그림 40 · Block Design" width="1036" height="786" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 40 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-41.png"><img src="/assets/images/lenet-project-2026/baseline-41.png" alt="BASELINE 원본 그림 41 · Block Design" width="1573" height="628" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 41 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

wieght bram에서도 주소를 바꿔줘야함.


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-42.png"><img src="/assets/images/lenet-project-2026/baseline-42.png" alt="BASELINE 원본 그림 42 · Block Design" width="1035" height="786" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 42 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

최종적으로 weight bram도 image bram과 같이 해서 연결하면 다음과 같음.


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-43.png"><img src="/assets/images/lenet-project-2026/baseline-43.png" alt="BASELINE 원본 그림 43 · Block Design" width="1361" height="541" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 43 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-44.png"><img src="/assets/images/lenet-project-2026/baseline-44.png" alt="BASELINE 원본 그림 44 · Block Design" width="990" height="734" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 44 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-45.png"><img src="/assets/images/lenet-project-2026/baseline-45.png" alt="BASELINE 원본 그림 45 · Block Design" width="1372" height="840" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 45 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-46.png"><img src="/assets/images/lenet-project-2026/baseline-46.png" alt="BASELINE 원본 그림 46 · Block Design" width="433" height="851" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 46 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

Wrapper 생성 됐으면 generate bitstream

- Error Debugging


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-47.png"><img src="/assets/images/lenet-project-2026/baseline-47.png" alt="BASELINE 원본 그림 47 · Block Design" width="1014" height="145" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 47 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

WNS, TNS가 너무 심함. 그래서 clock을 50MHz로 낮춤


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-48.png"><img src="/assets/images/lenet-project-2026/baseline-48.png" alt="BASELINE 원본 그림 48 · Block Design" width="2306" height="322" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 48 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

일단은 해결했고 이건 나중에 가속화 할때 더 해볼거임.



<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-49.png"><img src="/assets/images/lenet-project-2026/baseline-49.png" alt="BASELINE 원본 그림 49 · Block Design" width="1605" height="213" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 49 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-50.png"><img src="/assets/images/lenet-project-2026/baseline-50.png" alt="BASELINE 원본 그림 50 · Block Design" width="640" height="601" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 50 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-51.png"><img src="/assets/images/lenet-project-2026/baseline-51.png" alt="BASELINE 원본 그림 51 · Block Design" width="779" height="664" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 51 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

<h5 class="lenet-original-heading">Block Design analysis</h5>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-52.png"><img src="/assets/images/lenet-project-2026/baseline-52.png" alt="BASELINE 원본 그림 52 · Block Design analysis" width="618" height="589" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 52 · Block Design analysis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-53.png"><img src="/assets/images/lenet-project-2026/baseline-53.png" alt="BASELINE 원본 그림 53 · Block Design analysis" width="1530" height="200" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 53 · Block Design analysis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-54.png"><img src="/assets/images/lenet-project-2026/baseline-54.png" alt="BASELINE 원본 그림 54 · Block Design analysis" width="1198" height="491" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 54 · Block Design analysis · 클릭하면 원본 크기로 보기</figcaption></figure>

<h3 class="lenet-original-heading">PS 부분</h3>

<h4 class="lenet-original-heading">Vitis</h4>

- 만드는 과정


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-55.png"><img src="/assets/images/lenet-project-2026/baseline-55.png" alt="BASELINE 원본 그림 55 · Vitis" width="1968" height="1082" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 55 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-56.png"><img src="/assets/images/lenet-project-2026/baseline-56.png" alt="BASELINE 원본 그림 56 · Vitis" width="1057" height="708" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 56 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>

xsa찾아서 넣기


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-57.png"><img src="/assets/images/lenet-project-2026/baseline-57.png" alt="BASELINE 원본 그림 57 · Vitis" width="1049" height="707" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 57 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-58.png"><img src="/assets/images/lenet-project-2026/baseline-58.png" alt="BASELINE 원본 그림 58 · Vitis" width="450" height="157" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 58 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-59.png"><img src="/assets/images/lenet-project-2026/baseline-59.png" alt="BASELINE 원본 그림 59 · Vitis" width="498" height="485" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 59 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-60.png"><img src="/assets/images/lenet-project-2026/baseline-60.png" alt="BASELINE 원본 그림 60 · Vitis" width="680" height="552" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 60 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-61.png"><img src="/assets/images/lenet-project-2026/baseline-61.png" alt="BASELINE 원본 그림 61 · Vitis" width="1055" height="703" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 61 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-62.png"><img src="/assets/images/lenet-project-2026/baseline-62.png" alt="BASELINE 원본 그림 62 · Vitis" width="270" height="275" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 62 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-63.png"><img src="/assets/images/lenet-project-2026/baseline-63.png" alt="BASELINE 원본 그림 63 · Vitis" width="446" height="342" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 63 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-64.png"><img src="/assets/images/lenet-project-2026/baseline-64.png" alt="BASELINE 원본 그림 64 · Vitis" width="609" height="289" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 64 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>

- invalid command name ps7_init vitis 오류


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-65.png"><img src="/assets/images/lenet-project-2026/baseline-65.png" alt="BASELINE 원본 그림 65 · Vitis" width="509" height="80" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 65 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/baseline-66.png"><img src="/assets/images/lenet-project-2026/baseline-66.png" alt="BASELINE 원본 그림 66 · Vitis" width="1188" height="712" loading="lazy" decoding="async"></a><figcaption>BASELINE 원본 그림 66 · Vitis · 클릭하면 원본 크기로 보기</figcaption></figure>

- helloworld.c



```c
#include <stdio.h>
#include <stdint.h>
#include <limits.h>

#include "platform.h"
#include "xparameters.h"
#include "xil_printf.h"
#include "xil_io.h"
#include "xil_types.h"
#include "xil_exception.h"

#include "cnn_common_int32.h"

/* ========================================================================== */
/* Address-map detection                                                      */
/*                                                                            */
/* The first matching macro is used. If compilation stops here, open          */
/* xparameters.h, search each instance name, and add the generated macro.      */
/* ========================================================================== */
#if defined(XPAR_CSR_0_S00_AXI_BASEADDR)
# define CSR_BASEADDR XPAR_CSR_0_S00_AXI_BASEADDR
#elif defined(XPAR_CSR_0_BASEADDR)
# define CSR_BASEADDR XPAR_CSR_0_BASEADDR
#elif defined(XPAR_CSR_0_S_AXI_BASEADDR)
# define CSR_BASEADDR XPAR_CSR_0_S_AXI_BASEADDR
#else
# error "CSR base address not found. Search xparameters.h for CSR_0 and define CSR_BASEADDR."
#endif

#if defined(XPAR_IMAGE_BRAM_CTRL_S_AXI_BASEADDR)
# define IMAGE_BASEADDR XPAR_IMAGE_BRAM_CTRL_S_AXI_BASEADDR
#elif defined(XPAR_IMAGE_BRAM_CTRL_BASEADDR)
# define IMAGE_BASEADDR XPAR_IMAGE_BRAM_CTRL_BASEADDR
#elif defined(XPAR_IMAGE_BRAM_CTRL_C_S_AXI_BASEADDR)
# define IMAGE_BASEADDR XPAR_IMAGE_BRAM_CTRL_C_S_AXI_BASEADDR
#else
# error "Image BRAM controller base address not found. Search xparameters.h for IMAGE_BRAM_CTRL."
#endif

#if defined(XPAR_WEIGHT_BRAM_CTRL_S_AXI_BASEADDR)
# define WEIGHT_BASEADDR XPAR_WEIGHT_BRAM_CTRL_S_AXI_BASEADDR
#elif defined(XPAR_WEIGHT_BRAM_CTRL_BASEADDR)
# define WEIGHT_BASEADDR XPAR_WEIGHT_BRAM_CTRL_BASEADDR
#elif defined(XPAR_WEIGHT_BRAM_CTRL_C_S_AXI_BASEADDR)
# define WEIGHT_BASEADDR XPAR_WEIGHT_BRAM_CTRL_C_S_AXI_BASEADDR
#else
# error "Weight BRAM controller base address not found. Search xparameters.h for WEIGHT_BRAM_CTRL."
#endif

/* Change this only when FCLK_CLK0 changes in Vivado. */
#define PL_CLK_HZ              50000000ULL
#define TEST_COUNT             N_TEST
#define PL_TIMEOUT_US          2000000ULL
#define MAX_MISMATCH_PRINTS    20U

/* CSR register offsets */
#define CSR_CONTROL            0x00U
#define CSR_STATUS             0x04U
#define CSR_DEBUG              0x08U
#define CSR_VERSION            0x0CU
#define CSR_LOGIT0             0x10U
#define CSR_CYCLE_LO           0x38U
#define CSR_CYCLE_HI           0x3CU

/* CONTROL */
#define CTRL_START             (1U << 0)

/* STATUS */
#define STATUS_BUSY            (1U << 0)
#define STATUS_DONE            (1U << 1)
#define STATUS_OVERFLOW        (1U << 2)
#define STATUS_CORE_RST_N      (1U << 3)

#define IMAGE_WORDS            (IMG_SIZE / 4U)       /* 196 */
#define CONV1_WEIGHT_BYTES     (C1_OUT * IN_C * KH * KW)
#define CONV2_WEIGHT_BYTES     (C2_OUT * C1_OUT * KH * KW)
#define FC_WEIGHT_BYTES        (FC_OUT * FC_IN)
#define TOTAL_WEIGHT_BYTES     (CONV1_WEIGHT_BYTES + CONV2_WEIGHT_BYTES + FC_WEIGHT_BYTES)
#define WEIGHT_WORDS           (TOTAL_WEIGHT_BYTES / 4U)  /* 805 */

static inline u32 csr_read(u32 offset)
{
    return Xil_In32((UINTPTR)CSR_BASEADDR + offset);
}

static inline void csr_write(u32 offset, u32 value)
{
    Xil_Out32((UINTPTR)CSR_BASEADDR + offset, value);
}

static inline u32 pack_u8x4(const uint8_t *p)
{
    return ((u32)p[0]) |
           ((u32)p[1] << 8) |
           ((u32)p[2] << 16) |
           ((u32)p[3] << 24);
}

static inline u32 pack_i8x4(const int8_t *p)
{
    return ((u32)(uint8_t)p[0]) |
           ((u32)(uint8_t)p[1] << 8) |
           ((u32)(uint8_t)p[2] << 16) |
           ((u32)(uint8_t)p[3] << 24);
}

static int wait_until_idle(u64 timeout_us)
{
    const u64 start = Get_Global_Time();
    const u64 timeout_ticks =
        (timeout_us * (u64)GLOBAL_TIMER_FREQ_HZ) / 1000000ULL;

    while ((csr_read(CSR_STATUS) & STATUS_BUSY) != 0U) {
        if ((Get_Global_Time() - start) > timeout_ticks)
            return -1;
    }
    return 0;
}

static int load_weight_segment(
    const int8_t *weights,
    u32 byte_count,
    u32 *word_index)
{
    if ((byte_count & 3U) != 0U)
        return -1;

    for (u32 i = 0; i < byte_count; i += 4U) {
        Xil_Out32(
            (UINTPTR)WEIGHT_BASEADDR + ((UINTPTR)(*word_index) << 2),
            pack_i8x4(&weights[i]));
        ++(*word_index);
    }
    return 0;
}

static int pl_load_all_weights(void)
{
    if (wait_until_idle(PL_TIMEOUT_US) != 0)
        return -1;

    u32 word_index = 0;

    if (load_weight_segment(
            conv1_w_embedded,
            (u32)CONV1_WEIGHT_BYTES,
            &word_index) != 0)
        return -2;

    if (load_weight_segment(
            conv2_w_embedded,
            (u32)CONV2_WEIGHT_BYTES,
            &word_index) != 0)
        return -3;

    if (load_weight_segment(
            fc1_w_embedded,
            (u32)FC_WEIGHT_BYTES,
            &word_index) != 0)
        return -4;

    return (word_index == (u32)WEIGHT_WORDS) ? 0 : -5;
}

static int pl_load_image(const uint8_t *image)
{
    if (wait_until_idle(PL_TIMEOUT_US) != 0)
        return -1;

    for (u32 word = 0; word < (u32)IMAGE_WORDS; ++word) {
        Xil_Out32(
            (UINTPTR)IMAGE_BASEADDR + ((UINTPTR)word << 2),
            pack_u8x4(&image[word * 4U]));
    }
    return 0;
}

static u64 pl_read_cycle_count(void)
{
    /* The RTL timer result is latched at DONE and remains stable. */
    const u32 low = csr_read(CSR_CYCLE_LO);
    const u32 high = csr_read(CSR_CYCLE_HI);
    return ((u64)high << 32) | (u64)low;
}

static uint8_t pl_read_prediction(int32_t logits[FC_OUT])
{
    uint8_t best_idx = 0;

    for (u32 i = 0; i < FC_OUT; ++i)
        logits[i] = (int32_t)csr_read(CSR_LOGIT0 + i * 4U);

    int32_t best = logits[0];
    for (u32 i = 1; i < FC_OUT; ++i) {
        if (logits[i] > best) {
            best = logits[i];
            best_idx = (uint8_t)i;
        }
    }
    return best_idx;
}

static int pl_infer_one(
    const uint8_t *image,
    uint8_t *prediction,
    int32_t logits[FC_OUT],
    u64 *pl_cycles,
    u32 *final_status)
{
    if ((image == NULL) || (prediction == NULL) ||
        (logits == NULL) || (pl_cycles == NULL))
        return -1;

    if (pl_load_image(image) != 0)
        return -2;

    /* Writing bit 0 creates a one-FCLK start pulse and clears sticky status. */
    csr_write(CSR_CONTROL, CTRL_START);

    const u64 start = Get_Global_Time();
    const u64 timeout_ticks =
        (PL_TIMEOUT_US * (u64)GLOBAL_TIMER_FREQ_HZ) / 1000000ULL;

    u32 status;
    do {
        status = csr_read(CSR_STATUS);
        if ((Get_Global_Time() - start) > timeout_ticks) {
            if (final_status != NULL)
                *final_status = status;
            return -3;
        }
    } while ((status & STATUS_DONE) == 0U);

    *prediction = pl_read_prediction(logits);
    *pl_cycles = pl_read_cycle_count();

    if (final_status != NULL)
        *final_status = status;

    return ((status & STATUS_OVERFLOW) != 0U) ? 1 : 0;
}

static int hardware_self_check(void)
{
    const u32 version = csr_read(CSR_VERSION);
    const u32 status = csr_read(CSR_STATUS);

    printf("\r\nAddress map\r\n");
    printf("  CSR    : 0x%08lx\r\n", (unsigned long)CSR_BASEADDR);
    printf("  Image  : 0x%08lx\r\n", (unsigned long)IMAGE_BASEADDR);
    printf("  Weight : 0x%08lx\r\n", (unsigned long)WEIGHT_BASEADDR);
    printf("  VERSION: 0x%08lx\r\n", (unsigned long)version);
    printf("  STATUS : 0x%08lx\r\n", (unsigned long)status);

    if (version != 0x00010000U) {
        printf("ERROR: CSR version mismatch. Check CSR base address.\r\n");
        return -1;
    }

    if ((status & STATUS_CORE_RST_N) == 0U) {
        printf("ERROR: LeNet core is still in reset. Set SW0/reset high.\r\n");
        return -2;
    }

    if ((status & STATUS_BUSY) != 0U) {
        printf("ERROR: LeNet core is unexpectedly busy.\r\n");
        return -3;
    }

    return 0;
}

static void print_ratio_percent(const char *name, u32 correct, u32 total)
{
    const u32 percent_x100 =
        (total == 0U) ? 0U : (u32)(((u64)correct * 10000ULL) / total);

    printf("%s%lu/%lu = %lu.%02lu%%",
           name,
           (unsigned long)correct,
           (unsigned long)total,
           (unsigned long)(percent_x100 / 100U),
           (unsigned long)(percent_x100 % 100U));
}

static void print_us_x100(const char *name, u64 value_x100)
{
    printf("%s%llu.%02llu us",
           name,
           (unsigned long long)(value_x100 / 100ULL),
           (unsigned long long)(value_x100 % 100ULL));
}

static int run_single_image_test(u32 image_index)
{
    if (image_index >= N_TEST)
        return -1;

    const uint8_t *image = &test_1000_images_embedded[image_index * IMG_SIZE];
    const uint8_t label = test_1000_labels_embedded[image_index];

    int32_t logits[FC_OUT];
    uint8_t prediction = 0;
    u64 cycles = 0;
    u32 status = 0;

    const int rc = pl_infer_one(
        image, &prediction, logits, &cycles, &status);

    if (rc < 0) {
        printf("PL inference failed: rc=%d, STATUS=0x%08lx, DEBUG=%lu\r\n",
               rc,
               (unsigned long)status,
               (unsigned long)csr_read(CSR_DEBUG));
        return rc;
    }

    printf("\r\nImage %lu | label=%u | PL prediction=%u | cycles=%llu",
           (unsigned long)image_index,
           (unsigned int)label,
           (unsigned int)prediction,
           (unsigned long long)cycles);

    if (rc > 0)
        printf(" | OVERFLOW");
    printf("\r\n");

    for (u32 i = 0; i < FC_OUT; ++i) {
        printf("  logit[%lu] = %ld\r\n",
               (unsigned long)i,
               (long)logits[i]);
    }

    return (prediction == label) ? 0 : 1;
}

static void run_full_benchmark(void)
{
    printf("\r\n[PS vs PL E2E CNN] N_TEST=%u\r\n", (unsigned int)TEST_COUNT);

    /* ------------------------------- PS path ------------------------------ */
    printf(">>> CNN running in PS...\r\n");
    const u64 ps_t0 = Get_Global_Time();

    u32 correct_ps = 0;
    for (u32 i = 0; i < (u32)TEST_COUNT; ++i) {
        const uint8_t *image = &test_1000_images_embedded[i * IMG_SIZE];
        const uint8_t prediction = ps_forward_one_int32(image);
        if (prediction == test_1000_labels_embedded[i])
            ++correct_ps;

        if (((i + 1U) % 100U) == 0U)
            printf("  PS progress: %lu/%u\r\n",
                   (unsigned long)(i + 1U),
                   (unsigned int)TEST_COUNT);
    }

    const u64 ps_ticks = Get_Global_Time() - ps_t0;

    /* -------------------------- PL weight upload -------------------------- */
    printf(">>> Loading 805 packed weight words to PL...\r\n");
    const u64 weight_t0 = Get_Global_Time();
    const int weight_rc = pl_load_all_weights();
    const u64 weight_ticks = Get_Global_Time() - weight_t0;

    if (weight_rc != 0) {
        printf("ERROR: weight upload failed, rc=%d\r\n", weight_rc);
        return;
    }

    /* ------------------------------- PL path ------------------------------ */
    printf(">>> CNN running in PL...\r\n");
    const u64 pl_host_t0 = Get_Global_Time();

    u32 correct_pl = 0;
    u32 overflow_count = 0;
    u32 timeout_count = 0;
    u32 mismatch_prints = 0;
    u64 total_pl_cycles = 0;
    u64 min_pl_cycles = ULLONG_MAX;
    u64 max_pl_cycles = 0;

    for (u32 i = 0; i < (u32)TEST_COUNT; ++i) {
        const uint8_t *image = &test_1000_images_embedded[i * IMG_SIZE];
        const uint8_t label = test_1000_labels_embedded[i];

        int32_t logits[FC_OUT];
        uint8_t prediction = 0;
        u64 cycles = 0;
        u32 status = 0;

        const int rc = pl_infer_one(
            image, &prediction, logits, &cycles, &status);

        if (rc < 0) {
            ++timeout_count;
            printf("ERROR image[%lu]: rc=%d STATUS=0x%08lx DEBUG=%lu\r\n",
                   (unsigned long)i,
                   rc,
                   (unsigned long)status,
                   (unsigned long)csr_read(CSR_DEBUG));
            break;
        }

        if (rc > 0)
            ++overflow_count;

        total_pl_cycles += cycles;
        if (cycles < min_pl_cycles) min_pl_cycles = cycles;
        if (cycles > max_pl_cycles) max_pl_cycles = cycles;

        if (prediction == label) {
            ++correct_pl;
        } else if (mismatch_prints < MAX_MISMATCH_PRINTS) {
            printf("  mismatch image[%lu]: PL=%u label=%u cycles=%llu\r\n",
                   (unsigned long)i,
                   (unsigned int)prediction,
                   (unsigned int)label,
                   (unsigned long long)cycles);
            ++mismatch_prints;
        }

        if (((i + 1U) % 100U) == 0U) {
            printf("  PL progress: %lu/%u, correct=%lu\r\n",
                   (unsigned long)(i + 1U),
                   (unsigned int)TEST_COUNT,
                   (unsigned long)correct_pl);
        }
    }

    const u64 pl_host_ticks = Get_Global_Time() - pl_host_t0;

    /* -------------------------------- Summary ----------------------------- */
    const u64 ps_us = global_ticks_to_us(ps_ticks);
    const u64 weight_us = global_ticks_to_us(weight_ticks);
    const u64 pl_host_us = global_ticks_to_us(pl_host_ticks);

    const u64 avg_ps_us_x100 =
        ((u64)ps_us * 100ULL) / (u64)TEST_COUNT;
    const u64 avg_pl_host_us_x100 =
        ((u64)pl_host_us * 100ULL) / (u64)TEST_COUNT;
    const u64 avg_pl_pure_us_x100 =
        (total_pl_cycles * 100000000ULL) /
        (PL_CLK_HZ * (u64)TEST_COUNT);

    printf("\r\n==================== Summary ====================\r\n");
    print_ratio_percent("PS accuracy : ", correct_ps, TEST_COUNT);
    printf("\r\n");
    print_ratio_percent("PL accuracy : ", correct_pl, TEST_COUNT);
    printf("\r\n");

    printf("PS total                  : %llu us\r\n",
           (unsigned long long)ps_us);
    print_us_x100("PS average/image          : ", avg_ps_us_x100);
    printf("\r\n");

    printf("PL weight upload          : %llu us\r\n",
           (unsigned long long)weight_us);
    printf("PL host E2E total         : %llu us\r\n",
           (unsigned long long)pl_host_us);
    print_us_x100("PL host E2E average/image : ", avg_pl_host_us_x100);
    printf("\r\n");
    print_us_x100("PL pure average/image     : ", avg_pl_pure_us_x100);
    printf("\r\n");

    printf("PL total busy cycles      : %llu\r\n",
           (unsigned long long)total_pl_cycles);
    printf("PL min/max cycles         : %llu / %llu\r\n",
           (unsigned long long)min_pl_cycles,
           (unsigned long long)max_pl_cycles);
    printf("PL overflow count         : %lu\r\n",
           (unsigned long)overflow_count);
    printf("PL timeout count          : %lu\r\n",
           (unsigned long)timeout_count);

    if (avg_pl_pure_us_x100 != 0ULL) {
        const u64 speedup_x100 =
            (avg_ps_us_x100 * 100ULL) / avg_pl_pure_us_x100;
        printf("Speedup PS / pure PL      : %llu.%02llux\r\n",
               (unsigned long long)(speedup_x100 / 100ULL),
               (unsigned long long)(speedup_x100 % 100ULL));
    }
    printf("=================================================\r\n");
}

int main(void)
{
    init_platform();

    /* Enable Zynq-7000 global timer. */
    Xil_Out32(GTIMER_CONTROL_REG, 0x1U);

    printf("\r\n=================================================\r\n");
    printf(" LeNet Zynq PS/PL Acceleration Test\r\n");
    printf("=================================================\r\n");

    if (hardware_self_check() != 0) {
        printf("Hardware self-check failed. Stop.\r\n");
        while (1) { }
    }

    printf("Loading weights once for quick single-image test...\r\n");
    if (pl_load_all_weights() != 0) {
        printf("Initial weight upload failed.\r\n");
        while (1) { }
    }

    while (1) {
        printf("\r\n1: Run image 0 sanity test (expected label 4)\r\n");
        printf("2: Run full PS vs PL benchmark (%u images)\r\n",
               (unsigned int)TEST_COUNT);
        printf("3: Exit\r\n");
        printf("Selection: ");

        const int selection = inbyte();
        printf("%c\r\n", selection);

        switch (selection) {
        case '1':
            (void)run_single_image_test(0U);
            break;

        case '2':
            run_full_benchmark();
            break;

        case '3':
            printf("Exit.\r\n");
            cleanup_platform();
            return 0;

        default:
            printf("Invalid selection.\r\n");
            break;
        }
    }
}

```



- cnn_common_in32.h



```c
#include <stdio.h>
#include <stdint.h>
#include <limits.h>

#include "platform.h"
#include "xparameters.h"
#include "xil_printf.h"
#include "xil_io.h"
#include "xil_types.h"
#include "xil_exception.h"

#include "cnn_common_int32.h"

/* ========================================================================== */
/* Address-map detection                                                      */
/*                                                                            */
/* The first matching macro is used. If compilation stops here, open          */
/* xparameters.h, search each instance name, and add the generated macro.      */
/* ========================================================================== */
#if defined(XPAR_CSR_0_S00_AXI_BASEADDR)
# define CSR_BASEADDR XPAR_CSR_0_S00_AXI_BASEADDR
#elif defined(XPAR_CSR_0_BASEADDR)
# define CSR_BASEADDR XPAR_CSR_0_BASEADDR
#elif defined(XPAR_CSR_0_S_AXI_BASEADDR)
# define CSR_BASEADDR XPAR_CSR_0_S_AXI_BASEADDR
#else
# error "CSR base address not found. Search xparameters.h for CSR_0 and define CSR_BASEADDR."
#endif

#if defined(XPAR_IMAGE_BRAM_CTRL_S_AXI_BASEADDR)
# define IMAGE_BASEADDR XPAR_IMAGE_BRAM_CTRL_S_AXI_BASEADDR
#elif defined(XPAR_IMAGE_BRAM_CTRL_BASEADDR)
# define IMAGE_BASEADDR XPAR_IMAGE_BRAM_CTRL_BASEADDR
#elif defined(XPAR_IMAGE_BRAM_CTRL_C_S_AXI_BASEADDR)
# define IMAGE_BASEADDR XPAR_IMAGE_BRAM_CTRL_C_S_AXI_BASEADDR
#else
# error "Image BRAM controller base address not found. Search xparameters.h for IMAGE_BRAM_CTRL."
#endif

#if defined(XPAR_WEIGHT_BRAM_CTRL_S_AXI_BASEADDR)
# define WEIGHT_BASEADDR XPAR_WEIGHT_BRAM_CTRL_S_AXI_BASEADDR
#elif defined(XPAR_WEIGHT_BRAM_CTRL_BASEADDR)
# define WEIGHT_BASEADDR XPAR_WEIGHT_BRAM_CTRL_BASEADDR
#elif defined(XPAR_WEIGHT_BRAM_CTRL_C_S_AXI_BASEADDR)
# define WEIGHT_BASEADDR XPAR_WEIGHT_BRAM_CTRL_C_S_AXI_BASEADDR
#else
# error "Weight BRAM controller base address not found. Search xparameters.h for WEIGHT_BRAM_CTRL."
#endif

/* Change this only when FCLK_CLK0 changes in Vivado. */
#define PL_CLK_HZ              50000000ULL
#define TEST_COUNT             N_TEST
#define PL_TIMEOUT_US          2000000ULL
#define MAX_MISMATCH_PRINTS    20U

/* CSR register offsets */
#define CSR_CONTROL            0x00U
#define CSR_STATUS             0x04U
#define CSR_DEBUG              0x08U
#define CSR_VERSION            0x0CU
#define CSR_LOGIT0             0x10U
#define CSR_CYCLE_LO           0x38U
#define CSR_CYCLE_HI           0x3CU

/* CONTROL */
#define CTRL_START             (1U << 0)

/* STATUS */
#define STATUS_BUSY            (1U << 0)
#define STATUS_DONE            (1U << 1)
#define STATUS_OVERFLOW        (1U << 2)
#define STATUS_CORE_RST_N      (1U << 3)

#define IMAGE_WORDS            (IMG_SIZE / 4U)       /* 196 */
#define CONV1_WEIGHT_BYTES     (C1_OUT * IN_C * KH * KW)
#define CONV2_WEIGHT_BYTES     (C2_OUT * C1_OUT * KH * KW)
#define FC_WEIGHT_BYTES        (FC_OUT * FC_IN)
#define TOTAL_WEIGHT_BYTES     (CONV1_WEIGHT_BYTES + CONV2_WEIGHT_BYTES + FC_WEIGHT_BYTES)
#define WEIGHT_WORDS           (TOTAL_WEIGHT_BYTES / 4U)  /* 805 */

static inline u32 csr_read(u32 offset)
{
    return Xil_In32((UINTPTR)CSR_BASEADDR + offset);
}

static inline void csr_write(u32 offset, u32 value)
{
    Xil_Out32((UINTPTR)CSR_BASEADDR + offset, value);
}

static inline u32 pack_u8x4(const uint8_t *p)
{
    return ((u32)p[0]) |
           ((u32)p[1] << 8) |
           ((u32)p[2] << 16) |
           ((u32)p[3] << 24);
}

static inline u32 pack_i8x4(const int8_t *p)
{
    return ((u32)(uint8_t)p[0]) |
           ((u32)(uint8_t)p[1] << 8) |
           ((u32)(uint8_t)p[2] << 16) |
           ((u32)(uint8_t)p[3] << 24);
}

static int wait_until_idle(u64 timeout_us)
{
    const u64 start = Get_Global_Time();
    const u64 timeout_ticks =
        (timeout_us * (u64)GLOBAL_TIMER_FREQ_HZ) / 1000000ULL;

    while ((csr_read(CSR_STATUS) & STATUS_BUSY) != 0U) {
        if ((Get_Global_Time() - start) > timeout_ticks)
            return -1;
    }
    return 0;
}

static int load_weight_segment(
    const int8_t *weights,
    u32 byte_count,
    u32 *word_index)
{
    if ((byte_count & 3U) != 0U)
        return -1;

    for (u32 i = 0; i < byte_count; i += 4U) {
        Xil_Out32(
            (UINTPTR)WEIGHT_BASEADDR + ((UINTPTR)(*word_index) << 2),
            pack_i8x4(&weights[i]));
        ++(*word_index);
    }
    return 0;
}

static int pl_load_all_weights(void)
{
    if (wait_until_idle(PL_TIMEOUT_US) != 0)
        return -1;

    u32 word_index = 0;

    if (load_weight_segment(
            conv1_w_embedded,
            (u32)CONV1_WEIGHT_BYTES,
            &word_index) != 0)
        return -2;

    if (load_weight_segment(
            conv2_w_embedded,
            (u32)CONV2_WEIGHT_BYTES,
            &word_index) != 0)
        return -3;

    if (load_weight_segment(
            fc1_w_embedded,
            (u32)FC_WEIGHT_BYTES,
            &word_index) != 0)
        return -4;

    return (word_index == (u32)WEIGHT_WORDS) ? 0 : -5;
}

static int pl_load_image(const uint8_t *image)
{
    if (wait_until_idle(PL_TIMEOUT_US) != 0)
        return -1;

    for (u32 word = 0; word < (u32)IMAGE_WORDS; ++word) {
        Xil_Out32(
            (UINTPTR)IMAGE_BASEADDR + ((UINTPTR)word << 2),
            pack_u8x4(&image[word * 4U]));
    }
    return 0;
}

static u64 pl_read_cycle_count(void)
{
    /* The RTL timer result is latched at DONE and remains stable. */
    const u32 low = csr_read(CSR_CYCLE_LO);
    const u32 high = csr_read(CSR_CYCLE_HI);
    return ((u64)high << 32) | (u64)low;
}

static uint8_t pl_read_prediction(int32_t logits[FC_OUT])
{
    uint8_t best_idx = 0;

    for (u32 i = 0; i < FC_OUT; ++i)
        logits[i] = (int32_t)csr_read(CSR_LOGIT0 + i * 4U);

    int32_t best = logits[0];
    for (u32 i = 1; i < FC_OUT; ++i) {
        if (logits[i] > best) {
            best = logits[i];
            best_idx = (uint8_t)i;
        }
    }
    return best_idx;
}

static int pl_infer_one(
    const uint8_t *image,
    uint8_t *prediction,
    int32_t logits[FC_OUT],
    u64 *pl_cycles,
    u32 *final_status)
{
    if ((image == NULL) || (prediction == NULL) ||
        (logits == NULL) || (pl_cycles == NULL))
        return -1;

    if (pl_load_image(image) != 0)
        return -2;

    /* Writing bit 0 creates a one-FCLK start pulse and clears sticky status. */
    csr_write(CSR_CONTROL, CTRL_START);

    const u64 start = Get_Global_Time();
    const u64 timeout_ticks =
        (PL_TIMEOUT_US * (u64)GLOBAL_TIMER_FREQ_HZ) / 1000000ULL;

    u32 status;
    do {
        status = csr_read(CSR_STATUS);
        if ((Get_Global_Time() - start) > timeout_ticks) {
            if (final_status != NULL)
                *final_status = status;
            return -3;
        }
    } while ((status & STATUS_DONE) == 0U);

    *prediction = pl_read_prediction(logits);
    *pl_cycles = pl_read_cycle_count();

    if (final_status != NULL)
        *final_status = status;

    return ((status & STATUS_OVERFLOW) != 0U) ? 1 : 0;
}

static int hardware_self_check(void)
{
    const u32 version = csr_read(CSR_VERSION);
    const u32 status = csr_read(CSR_STATUS);

    printf("\r\nAddress map\r\n");
    printf("  CSR    : 0x%08lx\r\n", (unsigned long)CSR_BASEADDR);
    printf("  Image  : 0x%08lx\r\n", (unsigned long)IMAGE_BASEADDR);
    printf("  Weight : 0x%08lx\r\n", (unsigned long)WEIGHT_BASEADDR);
    printf("  VERSION: 0x%08lx\r\n", (unsigned long)version);
    printf("  STATUS : 0x%08lx\r\n", (unsigned long)status);

    if (version != 0x00010000U) {
        printf("ERROR: CSR version mismatch. Check CSR base address.\r\n");
        return -1;
    }

    if ((status & STATUS_CORE_RST_N) == 0U) {
        printf("ERROR: LeNet core is still in reset. Set SW0/reset high.\r\n");
        return -2;
    }

    if ((status & STATUS_BUSY) != 0U) {
        printf("ERROR: LeNet core is unexpectedly busy.\r\n");
        return -3;
    }

    return 0;
}

static void print_ratio_percent(const char *name, u32 correct, u32 total)
{
    const u32 percent_x100 =
        (total == 0U) ? 0U : (u32)(((u64)correct * 10000ULL) / total);

    printf("%s%lu/%lu = %lu.%02lu%%",
           name,
           (unsigned long)correct,
           (unsigned long)total,
           (unsigned long)(percent_x100 / 100U),
           (unsigned long)(percent_x100 % 100U));
}

static void print_us_x100(const char *name, u64 value_x100)
{
    printf("%s%llu.%02llu us",
           name,
           (unsigned long long)(value_x100 / 100ULL),
           (unsigned long long)(value_x100 % 100ULL));
}

static int run_single_image_test(u32 image_index)
{
    if (image_index >= N_TEST)
        return -1;

    const uint8_t *image = &test_1000_images_embedded[image_index * IMG_SIZE];
    const uint8_t label = test_1000_labels_embedded[image_index];

    int32_t logits[FC_OUT];
    uint8_t prediction = 0;
    u64 cycles = 0;
    u32 status = 0;

    const int rc = pl_infer_one(
        image, &prediction, logits, &cycles, &status);

    if (rc < 0) {
        printf("PL inference failed: rc=%d, STATUS=0x%08lx, DEBUG=%lu\r\n",
               rc,
               (unsigned long)status,
               (unsigned long)csr_read(CSR_DEBUG));
        return rc;
    }

    printf("\r\nImage %lu | label=%u | PL prediction=%u | cycles=%llu",
           (unsigned long)image_index,
           (unsigned int)label,
           (unsigned int)prediction,
           (unsigned long long)cycles);

    if (rc > 0)
        printf(" | OVERFLOW");
    printf("\r\n");

    for (u32 i = 0; i < FC_OUT; ++i) {
        printf("  logit[%lu] = %ld\r\n",
               (unsigned long)i,
               (long)logits[i]);
    }

    return (prediction == label) ? 0 : 1;
}

static void run_full_benchmark(void)
{
    printf("\r\n[PS vs PL E2E CNN] N_TEST=%u\r\n", (unsigned int)TEST_COUNT);

    /* ------------------------------- PS path ------------------------------ */
    printf(">>> CNN running in PS...\r\n");
    const u64 ps_t0 = Get_Global_Time();

    u32 correct_ps = 0;
    for (u32 i = 0; i < (u32)TEST_COUNT; ++i) {
        const uint8_t *image = &test_1000_images_embedded[i * IMG_SIZE];
        const uint8_t prediction = ps_forward_one_int32(image);
        if (prediction == test_1000_labels_embedded[i])
            ++correct_ps;

        if (((i + 1U) % 100U) == 0U)
            printf("  PS progress: %lu/%u\r\n",
                   (unsigned long)(i + 1U),
                   (unsigned int)TEST_COUNT);
    }

    const u64 ps_ticks = Get_Global_Time() - ps_t0;

    /* -------------------------- PL weight upload -------------------------- */
    printf(">>> Loading 805 packed weight words to PL...\r\n");
    const u64 weight_t0 = Get_Global_Time();
    const int weight_rc = pl_load_all_weights();
    const u64 weight_ticks = Get_Global_Time() - weight_t0;

    if (weight_rc != 0) {
        printf("ERROR: weight upload failed, rc=%d\r\n", weight_rc);
        return;
    }

    /* ------------------------------- PL path ------------------------------ */
    printf(">>> CNN running in PL...\r\n");
    const u64 pl_host_t0 = Get_Global_Time();

    u32 correct_pl = 0;
    u32 overflow_count = 0;
    u32 timeout_count = 0;
    u32 mismatch_prints = 0;
    u64 total_pl_cycles = 0;
    u64 min_pl_cycles = ULLONG_MAX;
    u64 max_pl_cycles = 0;

    for (u32 i = 0; i < (u32)TEST_COUNT; ++i) {
        const uint8_t *image = &test_1000_images_embedded[i * IMG_SIZE];
        const uint8_t label = test_1000_labels_embedded[i];

        int32_t logits[FC_OUT];
        uint8_t prediction = 0;
        u64 cycles = 0;
        u32 status = 0;

        const int rc = pl_infer_one(
            image, &prediction, logits, &cycles, &status);

        if (rc < 0) {
            ++timeout_count;
            printf("ERROR image[%lu]: rc=%d STATUS=0x%08lx DEBUG=%lu\r\n",
                   (unsigned long)i,
                   rc,
                   (unsigned long)status,
                   (unsigned long)csr_read(CSR_DEBUG));
            break;
        }

        if (rc > 0)
            ++overflow_count;

        total_pl_cycles += cycles;
        if (cycles < min_pl_cycles) min_pl_cycles = cycles;
        if (cycles > max_pl_cycles) max_pl_cycles = cycles;

        if (prediction == label) {
            ++correct_pl;
        } else if (mismatch_prints < MAX_MISMATCH_PRINTS) {
            printf("  mismatch image[%lu]: PL=%u label=%u cycles=%llu\r\n",
                   (unsigned long)i,
                   (unsigned int)prediction,
                   (unsigned int)label,
                   (unsigned long long)cycles);
            ++mismatch_prints;
        }

        if (((i + 1U) % 100U) == 0U) {
            printf("  PL progress: %lu/%u, correct=%lu\r\n",
                   (unsigned long)(i + 1U),
                   (unsigned int)TEST_COUNT,
                   (unsigned long)correct_pl);
        }
    }

    const u64 pl_host_ticks = Get_Global_Time() - pl_host_t0;

    /* -------------------------------- Summary ----------------------------- */
    const u64 ps_us = global_ticks_to_us(ps_ticks);
    const u64 weight_us = global_ticks_to_us(weight_ticks);
    const u64 pl_host_us = global_ticks_to_us(pl_host_ticks);

    const u64 avg_ps_us_x100 =
        ((u64)ps_us * 100ULL) / (u64)TEST_COUNT;
    const u64 avg_pl_host_us_x100 =
        ((u64)pl_host_us * 100ULL) / (u64)TEST_COUNT;
    const u64 avg_pl_pure_us_x100 =
        (total_pl_cycles * 100000000ULL) /
        (PL_CLK_HZ * (u64)TEST_COUNT);

    printf("\r\n==================== Summary ====================\r\n");
    print_ratio_percent("PS accuracy : ", correct_ps, TEST_COUNT);
    printf("\r\n");
    print_ratio_percent("PL accuracy : ", correct_pl, TEST_COUNT);
    printf("\r\n");

    printf("PS total                  : %llu us\r\n",
           (unsigned long long)ps_us);
    print_us_x100("PS average/image          : ", avg_ps_us_x100);
    printf("\r\n");

    printf("PL weight upload          : %llu us\r\n",
           (unsigned long long)weight_us);
    printf("PL host E2E total         : %llu us\r\n",
           (unsigned long long)pl_host_us);
    print_us_x100("PL host E2E average/image : ", avg_pl_host_us_x100);
    printf("\r\n");
    print_us_x100("PL pure average/image     : ", avg_pl_pure_us_x100);
    printf("\r\n");

    printf("PL total busy cycles      : %llu\r\n",
           (unsigned long long)total_pl_cycles);
    printf("PL min/max cycles         : %llu / %llu\r\n",
           (unsigned long long)min_pl_cycles,
           (unsigned long long)max_pl_cycles);
    printf("PL overflow count         : %lu\r\n",
           (unsigned long)overflow_count);
    printf("PL timeout count          : %lu\r\n",
           (unsigned long)timeout_count);

    if (avg_pl_pure_us_x100 != 0ULL) {
        const u64 speedup_x100 =
            (avg_ps_us_x100 * 100ULL) / avg_pl_pure_us_x100;
        printf("Speedup PS / pure PL      : %llu.%02llux\r\n",
               (unsigned long long)(speedup_x100 / 100ULL),
               (unsigned long long)(speedup_x100 % 100ULL));
    }
    printf("=================================================\r\n");
}

int main(void)
{
    init_platform();

    /* Enable Zynq-7000 global timer. */
    Xil_Out32(GTIMER_CONTROL_REG, 0x1U);

    printf("\r\n=================================================\r\n");
    printf(" LeNet Zynq PS/PL Acceleration Test\r\n");
    printf("=================================================\r\n");

    if (hardware_self_check() != 0) {
        printf("Hardware self-check failed. Stop.\r\n");
        while (1) { }
    }

    printf("Loading weights once for quick single-image test...\r\n");
    if (pl_load_all_weights() != 0) {
        printf("Initial weight upload failed.\r\n");
        while (1) { }
    }

    while (1) {
        printf("\r\n1: Run image 0 sanity test (expected label 4)\r\n");
        printf("2: Run full PS vs PL benchmark (%u images)\r\n",
               (unsigned int)TEST_COUNT);
        printf("3: Exit\r\n");
        printf("Selection: ");

        const int selection = inbyte();
        printf("%c\r\n", selection);

        switch (selection) {
        case '1':
            (void)run_single_image_test(0U);
            break;

        case '2':
            run_full_benchmark();
            break;

        case '3':
            printf("Exit.\r\n");
            cleanup_platform();
            return 0;

        default:
            printf("Invalid selection.\r\n");
            break;
        }
    }
}

```




<h4 class="lenet-original-heading">PS Result</h4>



```bash
===============================================
 LeNet Baseline Accelerator Benchmark
 PS image -> PL inference -> PS result
===============================================

CSR     : 0x43c00000
IMAGE   : 0x40000000
WEIGHT  : 0x42000000
VERSION : 0x00010000
STATUS  : 0x00000008

[PS -> PL -> PS] 1000 images
mismatch image[10]: PL=0 label=3
mismatch image[11]: PL=2 label=4
mismatch image[20]: PL=8 label=1
mismatch image[59]: PL=1 label=2
mismatch image[61]: PL=9 label=4
mismatch image[94]: PL=8 label=2
mismatch image[110]: PL=9 label=7
mismatch image[128]: PL=8 label=1
mismatch image[246]: PL=5 label=3
mismatch image[273]: PL=9 label=0
mismatch image[278]: PL=4 label=0
mismatch image[287]: PL=0 label=6
mismatch image[316]: PL=2 label=7
mismatch image[508]: PL=5 label=3
mismatch image[520]: PL=9 label=4
mismatch image[527]: PL=9 label=4

==================== Summary ====================
Processed                   : 1000/1000
Accuracy                    : 984/1000 = 98.40%
Wrong                       : 16
Weight upload once          : 297 us
PS->PL->PS E2E total        : 8760471 us (8.760 s)
E2E + initial weight upload : 8760768 us (8.760 s)
E2E average/image           : 8760.47 us
Pure PL compute total       : 8686600 us
Pure PL average/image       : 8686.60 us
PS/AXI/control overhead     : 73871 us
PL total busy cycles        : 434330000
PL min/max cycles           : 434330 / 434330
PL overflow count           : 0
PL timeout count            : 0
=================================================

Test completed.
```



<h3 class="lenet-original-heading">PS–PL과 PL simulation 결과 비교</h3>

<h4 class="lenet-original-heading">1. 결과 요약</h4>

| 항목 | Arty Z7 실제 보드 | RTL Simulation |
| --- | --- | --- |
| 테스트 이미지 | 1,000장 | 1,000장 |
| 정확도 | **98.40%** | **98.60%** |
| 정답 수 | 984 | 986 |
| 오답 수 | 16 | 14 |
| 동작 클록 | 50 MHz | 100 MHz |
| 이미지당 PL Cycle | 434,330 | 434,330 |
| 전체 PL Cycle | 434,330,000 | 434,330,000 |
| 순수 PL 연산 시간 | 8.6866초 | 4.3433초 |
| 전체 처리 시간 | 8.760초 | 4.345초 |
| Overflow | 0 | 0 |
| Timeout / X·Z | 0 | 0 |

<h4 class="lenet-original-heading">2. 병목 분석</h4>

실제 보드의 전체 처리시간은 다음과 같음.

- 전체 처리시간: 8.760초
- 순수 PL 연산시간: 8.6866초
- PS·AXI·제어 오버헤드: 약 0.0734초

비율로 보면 다음과 같음.

- PL 연산 비중: 약 99.16%
- PS·AXI·제어 비중: 약 0.84%

따라서 현재 시스템의 주요 병목은 PS가 아니라 **PL의 연산 구조**임.

특히 현재 가속기는 하나의 MAC을 반복 사용하는 단일 MAC 구조이므로, 이미지 한 장을 처리하는 데 434,330 Cycle이 필요함.

---

<h4 class="lenet-original-heading">3. Upgrade 방향</h4>

<h5 class="lenet-original-heading">1순위: MAC 병렬화</h5>

단일 MAC을 2개, 4개 또는 8개로 확장하여 여러 곱셈·누산 연산을 동시에 수행함.

<h5 class="lenet-original-heading">2순위: BRAM 구조 개선</h5>

병렬 MAC에 여러 Input과 Weight를 동시에 공급할 수 있도록 BRAM Bank 분할, Wide Data 구조 및 Dual-Port BRAM을 적용함.

<h5 class="lenet-original-heading">3순위: 연산 파이프라이닝</h5>

주소 생성, BRAM Read, Multiply, Accumulate 과정을 중첩하여 MAC이 데이터를 기다리는 Cycle을 줄임.

<h5 class="lenet-original-heading">4순위: 클록 향상</h5>

파이프라인과 Critical Path를 개선한 후 50 MHz에서 75 MHz 또는 100 MHz로 동작 주파수를 높임.

<h5 class="lenet-original-heading">5순위: PS·AXI 최적화</h5>

PL 연산시간이 충분히 감소한 이후 DMA, Burst 전송, Double Buffering 및 Interrupt를 적용함.
{% endraw %}


## 9. Accelerator v2 전체 구현과 검증 기록
{: #record-v2}

<p class="lenet-record-note">원문의 병목 분석에서 RTL, testbench, Block Design, PS 코드와 로그로 이어진다. 연산 예시와 전체 소스 코드는 코드 블록으로 표시했다.</p>

{% raw %}

<h3 class="lenet-original-heading">LeNet accelerator v2</h3>

<h3 class="lenet-original-heading">PL 영역</h3>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-01.png"><img src="/assets/images/lenet-project-2026/v2-01.png" alt="V2 원본 그림 1 · PL 영역" width="1619" height="971" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 1 · PL 영역 · 클릭하면 원본 크기로 보기</figcaption></figure>

<h4 class="lenet-original-heading">Baseline과의 차이</h4>

| 항목 | Baseline | Accelerator v2 |
| --- | --- | --- |
| 실행 방식 | 계층별 순차 실행 | 스트리밍 및 일부 계층 중첩 |
| Conv 연산기 | Conv1/Conv2 공용 단일 엔진 | Conv1·Conv2 전용 엔진 |
| ReLU/Pool | 별도 모듈 | Conv 엔진 내부에 통합 |
| Conv1 병렬도 | 단일 MAC 중심 | 50 DSP |
| Conv2 병렬도 | 단일 MAC 중심 | 100 DSP |
| FC 병렬도 | 순차 처리 | 10개 class MAC lane |
| 중간 메모리 | `2304 × 32` Feature Map BRAM | Pool1 Ping/Pong BRAM |
| Pool2 저장 | Feature Map BRAM에 저장 | FC로 직접 스트리밍 |
| 이미지 버퍼 | 단일 Image BRAM | Image Ping/Pong BRAM |
| 가중치 접근 | Weight BRAM에서 반복 접근 | 최초 preload 후 local cache |
| 프레임 처리 | 한 프레임씩 | 최대 2개 frame slot |
| cycle 측정 | 상위 제어 중심 | 프레임별 PL timer 2개 |

우선 Bottleneck과 그 해결 방안에 대해 보겠음.

<h5 class="lenet-original-heading">Bottleneck 1 - 공유 Feature Map BRAM의 반복적인 Read/Write</h5>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-02.png"><img src="/assets/images/lenet-project-2026/v2-02.png" alt="V2 원본 그림 2 · Bottleneck 1 - 공유 Feature Map BRAM의 반복적인 Read/Write" width="1672" height="941" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 2 · Bottleneck 1 - 공유 Feature Map BRAM의 반복적인 Read/Write · 클릭하면 원본 크기로 보기</figcaption></figure>

Baseline은 conv, relu, pool 사이에 feature BRAM이 계속 사용되며 memory의 read/write를 반복했고 그로 인해 bottleneck이 발생함. 그래서 Conv. ReLU, Pool을 하나의 module로 만들어 버려서 BRAM 접근수를 낮춤.

<h5 class="lenet-original-heading">Bottleneck2 - 하나의 MAC 연산기를 반복 사용하면서 발생하는 낮은 연산 처리율</h5>

<h6 class="lenet-original-heading">많은 MAC 연산량</h6>

Convolution은 하나의 출력값을 계산하기 위해 Kernel 내부의 모든 Activation과 Weight를 곱하고 더해야 함.

Conv1은 하나의 출력값마다 25회의 곱셈이 필요함



```text
Conv1

Output 크기       : 4 × 24 × 24
Kernel            : 5 × 5
출력당 곱셈 수     : 25

전체 곱셈 수
= 4 × 24 × 24 × 25
= 57,600
```



Conv2는 출력값 하나마다 4개의 입력 채널과 5×5 Kernel을 처리해야 함.



```text
Conv2

Output 크기       : 12 × 8 × 8
Input Channel     : 4
Kernel            : 5 × 5
출력당 곱셈 수     : 4 × 25 = 100

전체 곱셈 수
= 12 × 8 × 8 × 4 × 25
= 76,800
```



FC는 192개의 입력 Feature와 10개의 출력 Class를 사용함.



```text
FC 전체 곱셈 수
= 192 × 10
= 1,920
```



따라서 한 이미지의 추론에는 총 다음과 같은 곱셈이 필요함.



```text
57,600 + 76,800 + 1,920
= 136,320 multiplications
```



Baseline의 단일 MAC Engine이 이를 순차 처리하면 연산만으로도 매우 많은 Clock Cycle이 필요함.

---

<h6 class="lenet-original-heading">출력 채널을 순차 처리</h6>

같은 입력 Window는 여러 출력 채널 계산에 반복해서 사용됨.

예를 들어 Conv1에서는 하나의 5×5 입력 Window로 4개의 출력 채널을 계산함.



```text
하나의 5×5 Window
├─ Filter 0 → Output Channel 0
├─ Filter 1 → Output Channel 1
├─ Filter 2 → Output Channel 2
└─ Filter 3 → Output Channel 3
```



Baseline에서는 이 출력 채널을 하나씩 순차적으로 계산함.



```text
Window 0 + Filter 0
→ Window 0 + Filter 1
→ Window 0 + Filter 2
→ Window 0 + Filter 3
```



입력 Window는 동일하지만 하나의 MAC 경로만 사용하므로 출력 채널 수에 비례하여 Cycle이 증가함.

Conv2에서는 이 문제가 더 커짐.



```text
Input Channel : 4
Output Channel: 12
Kernel Tap    : 25
```



하나의 공간 위치에 대해 총 `12 × 4 × 25 = 1,200`회의 곱셈이 필요하므로 단일 MAC 구조에서는 Conv2가 전체 추론시간의 큰 비중을 차지하게 됨.

---

<h6 class="lenet-original-heading">Conv1과 Conv2가 하나의 Engine을 공유</h6>

Baseline의 `conv_engine`은 Conv1과 Conv2가 공용으로 사용함.



```text
Conv1 실행
→ Conv1 완전 종료
→ ReLU1
→ Pool1
→ Conv2 실행
```



Conv1과 Conv2가 물리적으로 분리되어 있지 않기 때문에 서로 다른 프레임이나 계층의 Convolution을 동시에 처리할 수 없음. 이는 FPGA에 사용 가능한 DSP 자원이 남아 있더라도 하나의 연산 경로만 활성화되는 낮은 Hardware Utilization으로 이어짐.

그래서



```text
Conv1 Engine : 50 DSP
Conv2 Engine : 100 DSP
FC Engine    : 10 DSP

Total        : 160 DSP
```



를 사용함.

---

<h6 class="lenet-original-heading">Conv1의 50-DSP 병렬 구조</h6>

Conv1 출력 하나를 계산하려면 25개의 Kernel Tap 곱셈이 필요함.

Accelerator v2에서는 하나의 출력 채널을 위한 25개의 곱셈을 동시에 수행함.

또한 두 개의 `dot25_pipeline`을 배치하여 두 출력 채널을 동시에 계산함.



```text
Dot-product Lane 0
= 25 multipliers
= Output Channel A

Dot-product Lane 1
= 25 multipliers
= Output Channel B

Total
= 25 × 2
= 50 DSP
```



Conv1의 출력 채널 처리 순서는 다음과 같음.



```text
Cycle A : Output Channel 0, 1
Cycle B : Output Channel 2, 3
```



따라서 Baseline이 하나의 Window에 대해 출력 채널 4개와 Kernel Tap 25개를 모두 순차 처리했다면, v2는 하나의 5×5 Dot-product를 병렬 계산하고 두 출력 채널을 동시에 처리함.



```text
Baseline 개념

25 Kernel Taps × 4 Output Channels
→ 최대 100회의 순차 Multiply

Accelerator v2

50 DSP
→ 2 Output Channels 동시 계산
→ 하나의 Window를 2 Issue Cycle로 처리
```



Conv1의 출력 공간은 `24×24 = 576`개이며, 각 Window를 두 번 Issue하므로 반복 Issue 수는 다음과 같음.



```text
576 Windows × 2 Channel Groups
= 1,152 Issue Cycles
```



---

<h6 class="lenet-original-heading">Conv2의 100-DSP 병렬 구조</h6>

Conv2에서는 하나의 출력 채널을 계산하기 위해 입력 채널 4개에 대한 5×5 Dot-product를 누적해야 함.

모든 출력 채널과 입력 채널을 완전히 병렬화하려면 다음 수의 Multiplier가 필요함.



```text
12 Output Channels
× 4 Input Channels
× 25 Kernel Taps
= 1,200 multipliers
```



이는 Zynq-7020에서 사용할 수 있는 DSP 수를 크게 초과함.

따라서 Accelerator v2에서는 출력 채널 4개를 병렬 처리하고, 입력 채널 4개는 시간적으로 순차 누적하는 부분 병렬화 구조를 사용함.



```text
4 Output Lanes
× 25 Kernel Taps
= 100 DSP
```



Conv2 출력 채널 12개는 세 개의 Group으로 나뉨.



```text
Group 0 : Output Channel 0~3
Group 1 : Output Channel 4~7
Group 2 : Output Channel 8~11
```



각 Group은 입력 채널 0~3을 순차 처리함.



```text
Group 0
├─ Input Channel 0
├─ Input Channel 1
├─ Input Channel 2
└─ Input Channel 3

Group 1
├─ Input Channel 0
├─ Input Channel 1
├─ Input Channel 2
└─ Input Channel 3

Group 2
├─ Input Channel 0
├─ Input Channel 1
├─ Input Channel 2
└─ Input Channel 3
```



따라서 하나의 공간 위치에 필요한 Issue Cycle은 다음과 같음.



```text
3 Output Groups × 4 Input Channels
= 12 Issue Cycles
```



Conv2의 출력 공간은 `8×8 = 64`개이므로 전체 반복 Issue 수는 다음과 같음.

---

<h6 class="lenet-original-heading">FC의 10-DSP 병렬 구조</h6>

FC는 192개의 입력 Feature와 10개의 출력 Class로 구성됨.

Baseline 방식으로 경우는 다음과 같음.



```text
Class 0의 192개 MAC
→ Class 1의 192개 MAC
→ ...
→ Class 9의 192개 MAC
```



Accelerator v2에서는 Class별로 독립적인 Weight Bank와 MAC Lane을 배치함.



```text
하나의 Input Activation
├─ Class 0 Weight × Activation
├─ Class 1 Weight × Activation
├─ Class 2 Weight × Activation
├─ ...
└─ Class 9 Weight × Activation
```



따라서 하나의 Activation이 입력될 때 10개 Class Accumulator가 동시에 갱신됨.



```text
10 Output Classes
× 1 Multiplier per Class
= 10 DSP
```



FC는 192개의 Activation을 받아야 하므로 기본 처리 구조는 다음과 같음.



```text
192 Activation Cycles
+ Pipeline Fill/Drain
```



현재 FC RTL은 하나의 pooled activation을 10개의 Class MAC Lane에 Broadcast하고, 10개의 독립 Weight Bank를 사용함.

<h5 class="lenet-original-heading">Bottleneck3 - 중복 데이터 접근</h5>

<h6 class="lenet-original-heading">인접 Window 사이의 중복 데이터 접근</h6>

5×5 Convolution에서 서로 인접한 두 Window는 25개 Pixel 중 20개를 공유함.



```text
현재 Window

[a b c d e]
[f g h i j]
[k l m n o]
[p q r s t]
[u v w x y]
```



Window를 오른쪽으로 한 칸 이동하면 다음과 같음.



```text
다음 Window

[b c d e A]
[g h i j B]
[l m n o C]
[q r s t D]
[v w x y E]
```



다음 Window에서 새롭게 필요한 값은 `A~E`의 5개 Pixel뿐임. 나머지 20개 Pixel은 직전 Window에 이미 존재하는 값임.

그런데 각 Window를 독립적으로 BRAM에서 읽으면 다음과 같은 문제가 발생함.



```text
Window 0을 위해 25개 Pixel Read
→ Window 1을 위해 다시 25개 Pixel Read
→ Window 2를 위해 다시 25개 Pixel Read
```



실제로 새롭게 필요한 값은 Window당 5개뿐인데, 기존 값을 재사용하지 않으면 BRAM Read 요청과 주소 생성이 반복됨.

---

<h6 class="lenet-original-heading">BRAM Port 대역폭의 한계</h6>

Conv1에서 하나의 5×5 Dot-product를 계산하려면 25개의 Activation이 필요함.

Conv2에서는 입력 채널이 4개이므로 하나의 공간 위치에 다음 크기의 Activation Window가 필요함.



```text
5 × 5 × 4 Input Channels
= 100 Activations
```



Conv1의 50개 DSP와 Conv2의 100개 DSP에 매 Cycle 필요한 Activation을 단일 Dual-port BRAM에서 직접 공급하는 것은 불가능함.



```text
필요한 데이터 병렬도

Conv1 : 25 Activation
Conv2 : 100 Activation

일반적인 Dual-port BRAM
: 제한된 수의 Word만 동시 Read 가능함
```



따라서 DSP 병렬화만 적용하고 Activation 공급 구조를 변경하지 않으면, DSP가 데이터를 기다리는 상태가 발생함.

---

<h5 class="lenet-original-heading">Synchronous BRAM Read Latency</h5>

Baseline과 v2에서 사용하는 BMG BRAM은 주소를 입력한 다음 Clock에 Read Data가 출력되는 Synchronous Memory임. Baseline의 Image, Weight, Feature Map BRAM도 1-cycle Read Latency로 구성됨.

단순한 요청·대기 구조에서는 다음 흐름이 반복됨.



```text
Clock N
→ BRAM Read Address 입력

Clock N+1
→ Read Data 수신

Clock N+2
→ 다음 데이터 처리
```



데이터를 하나 받을 때마다 다음 주소를 요청한다면 DSP Pipeline에 빈 Cycle이 발생할 수 있음.

---

<h5 class="lenet-original-heading">Window 생성기와 MAC Engine의 처리 속도 차이</h5>

Conv1은 하나의 Window를 생성한 뒤 두 Output Channel Group을 처리함.



```text
Cycle A : Output Channel 0, 1
Cycle B : Output Channel 2, 3
```



Window 생성기와 MAC Engine이 하나의 FSM으로 묶이면 Channel 2·3을 계산하는 동안 다음 Window 생성이 정지함.

즉 다음과 같은 종속성이 발생함.



```text
Window 생성
→ Channel 0, 1 계산
→ Channel 2, 3 계산
→ 다음 Window 생성
```



이 경우 Line Buffer가 있어도 Window 생성과 DSP 연산을 완전히 중첩할 수 없음.

Line Buffer는 현재 Pixel 위쪽에 위치한 이전 행의 Pixel을 내부에 저장하는 구조임.

5×5 Window를 생성하려면 현재 행을 포함하여 총 5개 행이 필요함.



```text
Previous Row 4
Previous Row 3
Previous Row 2
Previous Row 1
Current Row
→ 5×5 Window 생성
```



현재 행의 Pixel이 들어오면 해당 열에 저장되어 있던 이전 행의 값을 한 단계씩 이동함.



```text
line3[col] ← line2[col]
line2[col] ← line1[col]
line1[col] ← line0[col]
line0[col] ← current_pixel
```



이를 통해 이미 읽은 이전 행을 Image BRAM이나 Pool1 BRAM에서 다시 요청하지 않고 내부에서 재사용함.

<h5 class="lenet-original-heading">Bottleneck4 - Memory 사용이 끝날 때까지 기다리는 구간</h5>

<h6 class="lenet-original-heading">Image Memory의 Bottleneck</h6>

단일 Image BRAM을 사용하는 구조에서는 Conv1이 현재 이미지를 읽는 동안 외부 인터페이스가 같은 BRAM에 다음 이미지를 기록하기 어려움.



```text
Single Image BRAM

외부 입력 → Image BRAM Write
Conv1     ← Image BRAM Read
```



하나의 Bank에 대해 현재 프레임의 Read와 다음 프레임의 Write가 충돌할 수 있으므로, 일반적으로 다음과 같은 순차 실행이 필요함.



```text
Frame N 이미지 적재
→ Conv1이 Frame N 처리
→ Conv1의 Image BRAM Read 완료
→ Frame N+1 이미지 적재
```



이 구조에서는 이미지 전송 시간이 추론 시간 앞이나 뒤에 추가됨.

따라서 연산기가 다음 프레임을 처리할 준비가 되어 있어도, 이미지 적재가 끝날 때까지 기다려야 하는 Bottleneck이 발생함.

---

<h6 class="lenet-original-heading">Image Ping-Pong Buffer 적용</h6>

Image Memory를 Ping과 Pong 두 개의 독립 Bank로 구성함.



```text
Image Ping BRAM : 196 × 32-bit
Image Pong BRAM : 196 × 32-bit
```



`write_bank`와 `read_bank`를 독립적으로 선택하여, 한 Bank를 Conv1이 읽는 동안 다른 Bank에 다음 이미지를 기록하도록 설계함.



```text
Image Ping : Frame N   → Conv1 Read
Image Pong : Frame N+1 ← External Write
```



실제 `image_pingpong_bmg`에서도 `write_bank`와 `read_bank`가 별도 입력으로 존재하며, 선택된 Bank에 따라 Ping/Pong의 Write Enable과 Read Enable이 독립적으로 생성됨.

개념적인 동작은 다음과 같음.



```text
시간 ───────────────────────────────→

Image Ping : [Frame 0 적재] [Conv1 Frame 0 Read]
Image Pong :                [Frame 1 적재] [Conv1 Frame 1 Read]
```



<h6 class="lenet-original-heading">Top-level 제어</h6>

Top-level은 두 Frame Slot과 두 Image Bank의 사용 상태를 관리함.

빈 Bank가 존재하면 `image_ready`를 활성화하고, 가속기가 다른 프레임을 처리 중이더라도 다음 이미지를 받을 수 있도록 함.



```text
image_ready = 1
→ 현재 Load Bank가 비어 있음
→ 다음 이미지 적재 가능함
```



`load_bank`는 외부 입력이 쓸 Bank를 나타내며, `c1_active_bank`는 Conv1이 읽을 Bank를 나타냄.



```text
load_bank      : 다음 이미지가 기록될 Bank
c1_active_bank : Conv1이 현재 읽는 Bank
```



두 신호를 분리함으로써 외부 입력과 Conv1의 Memory 접근을 중첩함.

---

<h6 class="lenet-original-heading">Pool1 Memory의 Bottleneck</h6>

Conv1의 최종 결과인 Pool1 Feature Map은 Conv2의 입력으로 사용됨.

단일 Pool1 BRAM을 사용할 경우 다음 두 작업이 같은 Memory를 동시에 요구함.



```text
Conv1(Frame N+1) → Pool1 결과 Write
Conv2(Frame N)   ← Pool1 결과 Read
```



하나의 Bank만 존재하면 Conv2가 Frame N의 데이터를 모두 읽을 때까지 Conv1이 Frame N+1의 결과를 기록하지 못하거나, Conv1이 기록을 완료할 때까지 Conv2가 기다려야 함.

따라서 서로 다른 프레임의 Conv1과 Conv2를 동시에 실행하기 어려움.



```text
Single Pool1 BRAM

Conv1 Frame N Write 완료
→ Conv2 Frame N Read 완료
→ Conv1 Frame N+1 Write 시작
```



이 구조에서는 Conv1과 Conv2가 각각 전용 연산기를 가지고 있어도 Memory 충돌로 인해 동시에 사용할 수 없음.

즉 연산기 병렬화의 효과가 단일 중간 Buffer에 의해 제한되는 Bottleneck임.

---

<h6 class="lenet-original-heading">Pool1 Ping-Pong Buffer 적용</h6>

Pool1 결과를 저장하는 Memory도 Ping과 Pong 두 Bank로 구성함.



```text
Pool1 Ping BRAM : 64-bit × 144
Pool1 Pong BRAM : 64-bit × 144
```



Write Bank와 Read Bank를 독립적으로 선택함.



```text
Conv1(Frame N+1) → Pool1 Pong Write
Conv2(Frame N)   ← Pool1 Ping Read
```



다음 단계에서는 두 Bank의 역할이 교환됨.



```text
Conv1(Frame N+2) → Pool1 Ping Write
Conv2(Frame N+1) ← Pool1 Pong Read
```



`p1_pingpong_bmg`는 독립적인 `write_bank`와 `read_bank`를 제공하므로 Conv1이 한 Bank에 기록하는 동안 Conv2가 다른 Bank를 읽을 수 있음.

<h6 class="lenet-original-heading">프레임 Pipeline</h6>

Pool1 Ping-Pong을 이용하면 서로 다른 프레임의 계층 실행을 다음과 같이 중첩할 수 있음.



```text
시간 ─────────────────────────────────────→

Frame N   : Conv1 ─────── Conv2 + FC
Frame N+1 :         Conv1 ─────── Conv2 + FC
Frame N+2 :                  Conv1 ─────── Conv2 + FC
```



Frame N이 Conv2와 FC에서 처리되는 동안 Frame N+1은 Conv1에서 처리됨.

따라서 Conv1과 Conv2가 서로 다른 프레임에 대해 동시에 활성화될 수 있음.

---

<h6 class="lenet-original-heading">Pool1 Row-ready를 통한 추가 Bottleneck 해결</h6>

Pool1 Ping-Pong을 사용하더라도 Conv2가 Pool1 전체 `12×12` 결과의 완성을 기다린다면 같은 프레임 내부에서는 Conv1과 Conv2가 여전히 순차 실행됨.



```text
Conv1이 Pool1 전체 12개 Row 기록
→ Pool1 전체 완료
→ Conv2 시작
```



하지만 Conv2의 5×5 Window를 생성하는 데 Pool1의 모든 행이 한 번에 필요한 것은 아님.

현재 처리할 Window에 필요한 행만 준비되어 있으면 Conv2가 먼저 시작할 수 있음.

각 Pool1 Bank에 12-bit `row_ready` 상태를 둠.



```text
row_ready[0]  : Pool1 Row 0 완료
row_ready[1]  : Pool1 Row 1 완료
...
row_ready[11] : Pool1 Row 11 완료
```



Conv1은 한 행에서 Channel 0~3의 기록이 모두 끝난 시점에 해당 Row의 Ready Bit를 활성화함.

현재 RTL에서는 두 번째 Channel Group인 Channel 2·3의 마지막 열 `write_col == 11`이 기록되면 해당 행을 완료된 것으로 표시함.



```text
if (write_enable&&write_group&&
    (write_col==4'd11))beginready_bank[write_row] <=1'b1;end
```



Conv2는 필요한 Row가 준비되었는지 확인한 후 읽기를 시작함.



```text
Conv1 : Pool1의 뒤쪽 Row 생성 중
Conv2 : 이미 완료된 앞쪽 Row 사용 중
```



<h4 class="lenet-original-heading">Verilog Code</h4>

<h5 class="lenet-original-heading">lenet_v2.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// 125 MHz optimized LeNet accelerator.
//
// Datapath:
//   Image Ping/Pong BMG
//     -> Conv1 50 DSP, one image scan, BRAM look-ahead
//     -> Pool1 Ping/Pong BMG, row-ready streaming
//     -> Conv2 100 DSP, one Pool1 scan, four-entry prefetch FIFO
//     -> FC 10 DSP
//
// Existing start/busy/done use remains valid for one-image-at-a-time software.
// image_ready additionally allows the next image to be written and committed
// while another image is being processed. The top keeps at most two frames.
// -----------------------------------------------------------------------------
module lenet_v2 (
    input  wire         clk,
    input  wire         rst_n,

    input  wire         start,
    output wire         busy,
    output reg          done,
    output wire         overflow_error,
    output wire [4:0]   debug_state,
    output reg  [63:0]  cycle_count,

    input  wire         image_we,
    input  wire [7:0]   image_waddr,
    input  wire [31:0]  image_wdata,
    output wire         image_ready,

    input  wire         weight_we,
    input  wire [9:0]   weight_waddr,
    input  wire [31:0]  weight_wdata,

    output reg  [319:0] logits_flat,
    output reg  [15:0]  result_frame_id
);
    // -------------------------------------------------------------------------
    // Frame-slot state. Image bank and Pool1 bank use the same slot number.
    // -------------------------------------------------------------------------
    reg frame_valid0;
    reg frame_valid1;
    reg c1_started0;
    reg c1_started1;
    reg c2_started0;
    reg c2_started1;
    reg [15:0] frame_id0;
    reg [15:0] frame_id1;
    reg [15:0] next_frame_id;
    wire [63:0] frame_cycles0;
    wire [63:0] frame_cycles1;

    reg load_bank;
    reg c1_active_bank;
    reg c2_active_bank;
    reg c2_frame_active;

    reg c1_start;
    reg c2_start;
    reg fc_start;
    reg cache_loader_start;

    reg weights_cached;
    reg c2_done_seen;
    reg fc_done_seen;

    wire load_bank_free;
    wire image_load_we;
    wire weight_load_we;
    wire start_accept;

    assign load_bank_free = load_bank ? !frame_valid1 : !frame_valid0;
    assign image_ready    = load_bank_free;
    assign image_load_we  = image_we && image_ready && !weight_we;
    assign weight_load_we = weight_we && !busy;
    assign start_accept   = start && image_ready && !image_we && !weight_we;

    // -------------------------------------------------------------------------
    // PL cycle timers instantiated inside lenet_v2.
    //
    // Two counters are required because Ping/Pong frames may overlap.
    // This is functionally identical to the former frame_cycles0/1 registers;
    // only the RTL hierarchy has been modularized.
    // -------------------------------------------------------------------------
    pl_cycle_timer u_pl_cycle_timer_bank0 (
        .clk    (clk),
        .rst_n  (rst_n),
        .start  (start_accept && !load_bank),
        .enable (frame_valid0),
        .count  (frame_cycles0)
    );

    pl_cycle_timer u_pl_cycle_timer_bank1 (
        .clk    (clk),
        .rst_n  (rst_n),
        .start  (start_accept && load_bank),
        .enable (frame_valid1),
        .count  (frame_cycles1)
    );

    // Engine status wires are declared before scheduler expressions.
    wire c1_busy;
    wire c1_done;
    wire c1_overflow;
    wire c2_busy;
    wire c2_done;
    wire c2_overflow;
    wire fc_busy;
    wire fc_done;
    wire fc_overflow;
    // -------------------------------------------------------------------------
    // Oldest-frame selection for the two stages.
    // -------------------------------------------------------------------------
    wire c1_pending0;
    wire c1_pending1;
    wire c1_pending_any;
    wire c1_select_bank;
    wire c1_can_launch;

    wire c2_pending0;
    wire c2_pending1;
    wire c2_pending_any;
    wire c2_select_existing_bank;
    wire c2_can_launch_existing;

    assign c1_pending0 = frame_valid0 && !c1_started0;
    assign c1_pending1 = frame_valid1 && !c1_started1;
    assign c1_pending_any = c1_pending0 || c1_pending1;
    assign c1_select_bank =
        (c1_pending0 && c1_pending1) ? ((frame_id1 < frame_id0) ? 1'b1 : 1'b0) :
        c1_pending1;
    assign c1_can_launch = weights_cached && !c1_busy && c1_pending_any;

    assign c2_pending0 = frame_valid0 && c1_started0 && !c2_started0;
    assign c2_pending1 = frame_valid1 && c1_started1 && !c2_started1;
    assign c2_pending_any = c2_pending0 || c2_pending1;
    assign c2_select_existing_bank =
        (c2_pending0 && c2_pending1) ? ((frame_id1 < frame_id0) ? 1'b1 : 1'b0) :
        c2_pending1;
    assign c2_can_launch_existing = weights_cached &&
                                    !c2_frame_active &&
                                    !c2_busy && !fc_busy &&
                                    c2_pending_any;

    // -------------------------------------------------------------------------
    // Weight BMG and cache loader.
    // -------------------------------------------------------------------------
    wire cache_loader_busy;
    wire cache_loader_done;
    wire [24:0] c1_weight_tap_we;
    wire [31:0] c1_weight_tap_wdata;
    wire [24:0] c2_weight_tap_we;
    wire [3:0]  c2_weight_bank_waddr;
    wire [31:0] c2_weight_bank_wdata;
    wire [9:0]  fc_weight_class_we;
    wire [7:0]  fc_weight_index;
    wire [7:0]  fc_weight_data;

    wire weight_bram_ren;
    wire [9:0] weight_bram_raddr;
    wire [31:0] weight_bram_rdata;
    wire weight_bram_rvalid;

    weight_bram_bmg_wrapper u_weight_bram (
        .clk        (clk),
        .rst_n      (rst_n),
        .ext_we     (weight_load_we),
        .ext_waddr  (weight_waddr),
        .ext_wdata  (weight_wdata),
        .int_ren    (weight_bram_ren),
        .int_raddr  (weight_bram_raddr),
        .int_rdata  (weight_bram_rdata),
        .int_rvalid (weight_bram_rvalid)
    );

    weight_cache_loader u_weight_cache_loader (
        .clk         (clk),
        .rst_n       (rst_n),
        .start       (cache_loader_start),
        .busy        (cache_loader_busy),
        .done        (cache_loader_done),
        .bram_ren    (weight_bram_ren),
        .bram_raddr  (weight_bram_raddr),
        .bram_rdata        (weight_bram_rdata),
        .bram_rvalid       (weight_bram_rvalid),
        .c1_tap_we         (c1_weight_tap_we),
        .c1_tap_wdata      (c1_weight_tap_wdata),
        .c2_tap_we         (c2_weight_tap_we),
        .c2_bank_waddr     (c2_weight_bank_waddr),
        .c2_bank_wdata     (c2_weight_bank_wdata),
        .fc_class_we       (fc_weight_class_we),
        .fc_index          (fc_weight_index),
        .fc_weight_data    (fc_weight_data)
    );

    // -------------------------------------------------------------------------
    // Image Ping/Pong BMG.
    // -------------------------------------------------------------------------
    wire        image_bram_ren;
    wire [7:0]  image_bram_raddr;
    wire [31:0] image_bram_rdata;
    wire        image_bram_rvalid;

    image_pingpong_bmg u_image_pingpong (
        .clk        (clk),
        .rst_n      (rst_n),
        .write_bank (load_bank),
        .ext_we     (image_load_we),
        .ext_waddr  (image_waddr),
        .ext_wdata  (image_wdata),
        .read_bank  (c1_active_bank),
        .int_ren    (image_bram_ren),
        .int_raddr  (image_bram_raddr),
        .int_rdata  (image_bram_rdata),
        .int_rvalid (image_bram_rvalid)
    );

    // -------------------------------------------------------------------------
    // Conv1 and Pool1 Ping/Pong BMG.
    // -------------------------------------------------------------------------
    wire        p1_we;
    wire        p1_group;
    wire [7:0]  p1_waddr;
    wire [3:0]  p1_wrow;
    wire [3:0]  p1_wcol;
    wire [15:0] p1_wdata0;
    wire [15:0] p1_wdata1;

    wire        p1_read_en;
    wire [7:0]  p1_read_addr;
    wire        p1_read_valid;
    wire [63:0] p1_read_data;
    wire [11:0] p1_row_ready;

    conv1_engine_50dsp u_conv1 (
        .clk                (clk),
        .rst_n              (rst_n),
        .start              (c1_start),
        .busy               (c1_busy),
        .done               (c1_done),
        .overflow_error     (c1_overflow),
        .image_ren          (image_bram_ren),
        .image_raddr        (image_bram_raddr),
        .image_rdata        (image_bram_rdata),
        .image_rvalid       (image_bram_rvalid),
        .weight_tap_we      (c1_weight_tap_we),
        .weight_tap_wdata   (c1_weight_tap_wdata),
        .p1_we              (p1_we),
        .p1_group           (p1_group),
        .p1_waddr           (p1_waddr),
        .p1_wrow            (p1_wrow),
        .p1_wcol            (p1_wcol),
        .p1_wdata0          (p1_wdata0),
        .p1_wdata1          (p1_wdata1)
    );

    p1_pingpong_bmg u_p1_pingpong (
        .clk               (clk),
        .rst_n             (rst_n),
        .write_frame_start (c1_start),
        .write_bank        (c1_active_bank),
        .write_enable      (p1_we),
        .write_group       (p1_group),
        .write_addr        (p1_waddr),
        .write_row         (p1_wrow),
        .write_col         (p1_wcol),
        .write_data0       (p1_wdata0),
        .write_data1       (p1_wdata1),
        .read_bank         (c2_active_bank),
        .read_en           (p1_read_en),
        .read_addr         (p1_read_addr),
        .read_valid        (p1_read_valid),
        .read_data         (p1_read_data),
        .row_ready         (p1_row_ready)
    );

    // -------------------------------------------------------------------------
    // Conv2 and FC.
    // -------------------------------------------------------------------------
    wire        p2_valid;
    wire [7:0]  p2_flat_index;
    wire [23:0] p2_activation;
    wire [319:0] fc_logits;

    conv2_engine_100dsp u_conv2 (
        .clk                (clk),
        .rst_n              (rst_n),
        .start              (c2_start),
        .busy               (c2_busy),
        .done               (c2_done),
        .overflow_error     (c2_overflow),
        .weight_tap_we      (c2_weight_tap_we),
        .weight_bank_waddr  (c2_weight_bank_waddr),
        .weight_bank_wdata  (c2_weight_bank_wdata),
        .p1_read_en         (p1_read_en),
        .p1_read_addr       (p1_read_addr),
        .p1_read_valid      (p1_read_valid),
        .p1_read_data       (p1_read_data),
        .p1_row_ready       (p1_row_ready),
        .p2_valid           (p2_valid),
        .p2_flat_index      (p2_flat_index),
        .p2_activation      (p2_activation)
    );

    fc_engine_10dsp u_fc (
        .clk            (clk),
        .rst_n          (rst_n),
        .start          (fc_start),
        .busy           (fc_busy),
        .done           (fc_done),
        .overflow_error (fc_overflow),
        .weight_class_we (fc_weight_class_we),
        .weight_index    (fc_weight_index),
        .weight_data     (fc_weight_data),
        .in_valid       (p2_valid),
        .in_flat_index  (p2_flat_index),
        .in_activation  (p2_activation),
        .logits_flat    (fc_logits)
    );

    assign overflow_error = c1_overflow | c2_overflow | fc_overflow;
    assign busy = frame_valid0 | frame_valid1 |
                  cache_loader_busy | c1_busy | c2_busy | fc_busy;
    assign debug_state = {
        busy,
        cache_loader_busy,
        c1_busy,
        c2_busy,
        fc_busy
    };

    // -------------------------------------------------------------------------
    // Frame scheduler and per-frame cycle counters.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            frame_valid0      <= 1'b0;
            frame_valid1      <= 1'b0;
            c1_started0       <= 1'b0;
            c1_started1       <= 1'b0;
            c2_started0       <= 1'b0;
            c2_started1       <= 1'b0;
            frame_id0         <= 16'd0;
            frame_id1         <= 16'd0;
            next_frame_id     <= 16'd0;
            load_bank         <= 1'b0;
            c1_active_bank    <= 1'b0;
            c2_active_bank    <= 1'b0;
            c2_frame_active   <= 1'b0;
            c1_start          <= 1'b0;
            c2_start          <= 1'b0;
            fc_start          <= 1'b0;
            cache_loader_start<= 1'b0;
            weights_cached    <= 1'b0;
            c2_done_seen      <= 1'b0;
            fc_done_seen      <= 1'b0;
            done              <= 1'b0;
            cycle_count       <= 64'd0;
            logits_flat       <= 320'd0;
            result_frame_id   <= 16'd0;
        end else begin
            c1_start           <= 1'b0;
            c2_start           <= 1'b0;
            fc_start           <= 1'b0;
            cache_loader_start <= 1'b0;
            done               <= 1'b0;

            if (weight_load_we)
                weights_cached <= 1'b0;

            // Commit the image currently stored in load_bank.
            if (start_accept) begin
                if (!load_bank) begin
                    frame_valid0  <= 1'b1;
                    c1_started0   <= 1'b0;
                    c2_started0   <= 1'b0;
                    frame_id0     <= next_frame_id;
                    if (!frame_valid1)
                        load_bank <= 1'b1;
                end else begin
                    frame_valid1  <= 1'b1;
                    c1_started1   <= 1'b0;
                    c2_started1   <= 1'b0;
                    frame_id1     <= next_frame_id;
                    if (!frame_valid0)
                        load_bank <= 1'b0;
                end
                next_frame_id <= next_frame_id + 16'd1;

                if (!weights_cached && !cache_loader_busy)
                    cache_loader_start <= 1'b1;
            end

            if (cache_loader_done)
                weights_cached <= 1'b1;

            // Launch the oldest frame on Conv1.
            if (c1_can_launch) begin
                c1_active_bank <= c1_select_bank;
                c1_start       <= 1'b1;
                if (c1_select_bank)
                    c1_started1 <= 1'b1;
                else
                    c1_started0 <= 1'b1;
            end

            // Launch Conv2/FC. Existing waiting work has priority. If none is
            // waiting, a frame launched on Conv1 this cycle starts immediately
            // and Conv2 waits on Pool1 row_ready.
            if (c2_can_launch_existing) begin
                c2_active_bank  <= c2_select_existing_bank;
                c2_frame_active<= 1'b1;
                c2_done_seen    <= 1'b0;
                fc_done_seen    <= 1'b0;
                c2_start        <= 1'b1;
                fc_start        <= 1'b1;
                if (c2_select_existing_bank)
                    c2_started1 <= 1'b1;
                else
                    c2_started0 <= 1'b1;
            end else if (weights_cached && !c2_frame_active &&
                         !c2_busy && !fc_busy && c1_can_launch) begin
                c2_active_bank   <= c1_select_bank;
                c2_frame_active <= 1'b1;
                c2_done_seen     <= 1'b0;
                fc_done_seen     <= 1'b0;
                c2_start         <= 1'b1;
                fc_start         <= 1'b1;
                if (c1_select_bank)
                    c2_started1 <= 1'b1;
                else
                    c2_started0 <= 1'b1;
            end

            if (c2_done)
                c2_done_seen <= 1'b1;
            if (fc_done)
                fc_done_seen <= 1'b1;

            // Retire the frame only when both Conv2 and FC have completed.
            if (c2_frame_active &&
                (c2_done_seen || c2_done) &&
                (fc_done_seen || fc_done)) begin
                done             <= 1'b1;
                logits_flat      <= fc_logits;
                c2_frame_active  <= 1'b0;
                c2_done_seen     <= 1'b0;
                fc_done_seen     <= 1'b0;

                if (!c2_active_bank) begin
                    cycle_count     <= frame_cycles0;
                    result_frame_id <= frame_id0;
                    frame_valid0    <= 1'b0;
                    c1_started0     <= 1'b0;
                    c2_started0     <= 1'b0;
                    // Change the load target only when the current target is
                    // occupied. This avoids switching banks midway through an
                    // external image upload.
                    if ((load_bank == 1'b1) &&
                        (frame_valid1 || (start_accept && load_bank)))
                        load_bank <= 1'b0;
                end else begin
                    cycle_count     <= frame_cycles1;
                    result_frame_id <= frame_id1;
                    frame_valid1    <= 1'b0;
                    c1_started1     <= 1'b0;
                    c2_started1     <= 1'b0;
                    if ((load_bank == 1'b0) &&
                        (frame_valid0 || (start_accept && !load_bank)))
                        load_bank <= 1'b1;
                end
            end
        end
    end
endmodule

```



<h5 class="lenet-original-heading">pl_cycle_timer.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// Per-frame PL cycle counter.
//
// This module is intentionally minimal. It is the module form of the original
// frame_cycles0/frame_cycles1 logic that was located directly in lenet_v2.
//
// start  : clear the counter for a newly accepted frame
// enable : count while the corresponding Ping/Pong frame slot is valid
//
// The parent lenet_v2 module latches count into cycle_count when that frame
// retires. Because all assignments are nonblocking, the retirement edge itself
// is not included, matching the original implementation exactly.
// -----------------------------------------------------------------------------
module pl_cycle_timer (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    input  wire        enable,
    output reg  [63:0] count
);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 64'd0;
        end else if (start) begin
            count <= 64'd0;
        end else if (enable) begin
            count <= count + 64'd1;
        end
    end

endmodule

```



<h5 class="lenet-original-heading">weight_bram_bmg_wrapper.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// Vivado Block Memory Generator wrapper for all packed model weights.
//
// Required IP module:
//   lenet_weight_bram
//   - Simple Dual Port RAM
//   - Port A: 32-bit write, depth 805
//   - Port B: 32-bit read,  depth 805
//   - Common clock
//   - Port-B read latency: 1 cycle
//   - No output register
//
// The authoritative model copy resides in this BMG BRAM. At the first start
// after a weight write, weight_cache_loader streams all 805 words into the
// parallel Conv1/Conv2/FC local caches.
// -----------------------------------------------------------------------------
module weight_bram_bmg_wrapper (
    input  wire        clk,
    input  wire        rst_n,

    input  wire        ext_we,
    input  wire [9:0]  ext_waddr,
    input  wire [31:0] ext_wdata,

    input  wire        int_ren,
    input  wire [9:0]  int_raddr,
    output wire [31:0] int_rdata,
    output reg         int_rvalid
);
    lenet_weight_bram u_lenet_weight_bram (
        .clka  (clk),
        .ena   (ext_we),
        .wea   (ext_we),
        .addra (ext_waddr),
        .dina  (ext_wdata),

        .clkb  (clk),
        .enb   (int_ren),
        .addrb (int_raddr),
        .doutb (int_rdata)
    );

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            int_rvalid <= 1'b0;
        else
            int_rvalid <= int_ren;
    end
endmodule

```



<h5 class="lenet-original-heading">weight_cache_loader.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// Balanced 125 MHz weight-cache loader.
//
// Key timing change versus the Stage-4 loader:
//   - busy no longer gates the whole sequential block.
//   - response handling and the three output interfaces use separate local
//     control cones.
//
// This removes the high-fanout path
//   busy_reg -> c2_tap_we_reg[*]
// without changing the preload sequence or the inference datapath.
// -----------------------------------------------------------------------------
module weight_cache_loader (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    output reg         busy,
    output reg         done,

    output wire        bram_ren,
    output wire [9:0]  bram_raddr,
    input  wire [31:0] bram_rdata,
    input  wire        bram_rvalid,

    output reg  [24:0] c1_tap_we,
    output reg  [31:0] c1_tap_wdata,

    output reg  [24:0] c2_tap_we,
    output reg  [3:0]  c2_bank_waddr,
    output reg  [31:0] c2_bank_wdata,

    output reg  [9:0]  fc_class_we,
    output reg  [7:0]  fc_index,
    output reg  [7:0]  fc_weight_data
);
    localparam [1:0] PH_C1 = 2'd0;
    localparam [1:0] PH_C2 = 2'd1;
    localparam [1:0] PH_FC = 2'd2;

    reg [1:0] phase;
    reg       pending;

    reg [4:0] c1_tap;
    reg [4:0] c2_tap;
    reg [3:0] c2_bank_addr;
    reg [1:0] lane;

    // Registered one-hot selectors remove variable barrel shifts.
    (* keep = "true", shreg_extract = "no" *) reg [24:0] c1_tap_onehot;
    (* keep = "true", shreg_extract = "no" *) reg [24:0] c2_tap_onehot;

    reg [3:0] fc_class;
    (* keep = "true", shreg_extract = "no" *) reg [9:0] fc_class_onehot;
    reg [7:0] fc_addr;

    reg [31:0] assemble_word;
    reg [11:0] current_byte_addr;
    reg [7:0]  selected_byte;

    integer c2_group_i;
    integer c2_ic_i;
    integer c2_oc_i;

    always @* begin
        c2_group_i = c2_bank_addr >> 2;
        c2_ic_i    = c2_bank_addr & 3;
        c2_oc_i    = c2_group_i*4 + lane;

        case (phase)
            PH_C1:
                current_byte_addr =
                    `CONV1_WEIGHT_BYTE_BASE + lane*25 + c1_tap;

            PH_C2:
                current_byte_addr =
                    `CONV2_WEIGHT_BYTE_BASE +
                    c2_oc_i*100 + c2_ic_i*25 + c2_tap;

            default:
                current_byte_addr =
                    `FC_WEIGHT_BYTE_BASE + fc_class*192 + fc_addr;
        endcase

        case (current_byte_addr[1:0])
            2'd0: selected_byte = bram_rdata[7:0];
            2'd1: selected_byte = bram_rdata[15:8];
            2'd2: selected_byte = bram_rdata[23:16];
            default: selected_byte = bram_rdata[31:24];
        endcase
    end

    // busy now drives only the BRAM request gate and external status logic.
    assign bram_ren   = busy && !pending;
    assign bram_raddr = current_byte_addr[11:2];

    // Separate response cones prevent one global enable from fanning out to
    // every output register.  keep/max_fanout encourages local LUT copies.
    (* keep = "true", max_fanout = 8 *)
    wire response_ctrl = bram_rvalid && pending;

    (* keep = "true", max_fanout = 8 *)
    wire response_c1 = bram_rvalid && pending && (phase == PH_C1);

    (* keep = "true", max_fanout = 8 *)
    wire response_c2 = bram_rvalid && pending && (phase == PH_C2);

    (* keep = "true", max_fanout = 8 *)
    wire response_fc = bram_rvalid && pending && (phase == PH_FC);

    (* keep = "true", max_fanout = 8 *)
    wire commit_c1 = response_c1 && (lane == 2'd3);

    (* keep = "true", max_fanout = 8 *)
    wire commit_c2 = response_c2 && (lane == 2'd3);

    // -------------------------------------------------------------------------
    // Main loader state.  There is intentionally no outer "else if (busy)".
    // At idle pending is zero, so response_ctrl is zero and state is held.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            busy            <= 1'b0;
            done            <= 1'b0;
            pending         <= 1'b0;
            phase           <= PH_C1;
            c1_tap          <= 5'd0;
            c2_tap          <= 5'd0;
            c2_bank_addr    <= 4'd0;
            lane            <= 2'd0;
            c1_tap_onehot   <= 25'b1;
            c2_tap_onehot   <= 25'b1;
            fc_class        <= 4'd0;
            fc_class_onehot <= 10'b1;
            fc_addr         <= 8'd0;
            assemble_word   <= 32'd0;
        end else begin
            done <= 1'b0;

            if (start && !busy) begin
                busy            <= 1'b1;
                pending         <= 1'b0;
                phase           <= PH_C1;
                c1_tap          <= 5'd0;
                c2_tap          <= 5'd0;
                c2_bank_addr    <= 4'd0;
                lane            <= 2'd0;
                c1_tap_onehot   <= 25'b1;
                c2_tap_onehot   <= 25'b1;
                fc_class        <= 4'd0;
                fc_class_onehot <= 10'b1;
                fc_addr         <= 8'd0;
                assemble_word   <= 32'd0;
            end else begin
                if (bram_ren)
                    pending <= 1'b1;

                if (response_ctrl) begin
                    pending <= 1'b0;

                    case (phase)
                        PH_C1: begin
                            case (lane)
                                2'd0: assemble_word[7:0]   <= selected_byte;
                                2'd1: assemble_word[15:8]  <= selected_byte;
                                2'd2: assemble_word[23:16] <= selected_byte;
                                default: assemble_word     <= assemble_word;
                            endcase

                            if (lane == 2'd3) begin
                                lane <= 2'd0;
                                if (c1_tap == 5'd24) begin
                                    phase         <= PH_C2;
                                    c2_tap        <= 5'd0;
                                    c2_tap_onehot <= 25'b1;
                                    c2_bank_addr  <= 4'd0;
                                    assemble_word <= 32'd0;
                                end else begin
                                    c1_tap        <= c1_tap + 5'd1;
                                    c1_tap_onehot <= {
                                        c1_tap_onehot[23:0], 1'b0
                                    };
                                end
                            end else begin
                                lane <= lane + 2'd1;
                            end
                        end

                        PH_C2: begin
                            case (lane)
                                2'd0: assemble_word[7:0]   <= selected_byte;
                                2'd1: assemble_word[15:8]  <= selected_byte;
                                2'd2: assemble_word[23:16] <= selected_byte;
                                default: assemble_word     <= assemble_word;
                            endcase

                            if (lane == 2'd3) begin
                                lane <= 2'd0;
                                if (c2_bank_addr == 4'd11) begin
                                    c2_bank_addr <= 4'd0;
                                    if (c2_tap == 5'd24) begin
                                        phase           <= PH_FC;
                                        fc_class        <= 4'd0;
                                        fc_class_onehot <= 10'b1;
                                        fc_addr         <= 8'd0;
                                    end else begin
                                        c2_tap        <= c2_tap + 5'd1;
                                        c2_tap_onehot <= {
                                            c2_tap_onehot[23:0], 1'b0
                                        };
                                    end
                                end else begin
                                    c2_bank_addr <= c2_bank_addr + 4'd1;
                                end
                            end else begin
                                lane <= lane + 2'd1;
                            end
                        end

                        default: begin
                            if (fc_addr == 8'd191) begin
                                fc_addr <= 8'd0;
                                if (fc_class == 4'd9) begin
                                    busy <= 1'b0;
                                    done <= 1'b1;
                                end else begin
                                    fc_class <= fc_class + 4'd1;
                                    fc_class_onehot <= {
                                        fc_class_onehot[8:0], 1'b0
                                    };
                                end
                            end else begin
                                fc_addr <= fc_addr + 8'd1;
                            end
                        end
                    endcase
                end
            end
        end
    end

    // -------------------------------------------------------------------------
    // Output stages.  These are separated from the main state block so busy
    // cannot become a common mux select for every write-enable/data register.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            c1_tap_we    <= 25'd0;
            c1_tap_wdata <= 32'd0;
        end else begin
            c1_tap_we <= 25'd0;
            if (response_c1)
                c1_tap_wdata <= {selected_byte, assemble_word[23:0]};
            if (commit_c1)
                c1_tap_we <= c1_tap_onehot;
        end
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            c2_tap_we       <= 25'd0;
            c2_bank_waddr   <= 4'd0;
            c2_bank_wdata   <= 32'd0;
        end else begin
            c2_tap_we <= 25'd0;
            if (response_c2) begin
                c2_bank_waddr <= c2_bank_addr;
                c2_bank_wdata <= {selected_byte, assemble_word[23:0]};
            end
            if (commit_c2)
                c2_tap_we <= c2_tap_onehot;
        end
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            fc_class_we    <= 10'd0;
            fc_index       <= 8'd0;
            fc_weight_data <= 8'd0;
        end else begin
            fc_class_we <= 10'd0;
            if (response_fc) begin
                fc_class_we    <= fc_class_onehot;
                fc_index       <= fc_addr;
                fc_weight_data <= selected_byte;
            end
        end
    end
endmodule

```



<h5 class="lenet-original-heading">image_pingpong_bmg.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// Two input-image banks built from two identical Vivado BMG IP instances.
//
// Required BMG module:
//   lenet_image_bram
//     Simple Dual Port RAM, 32-bit x 196, common clock,
//     Port A write, Port B read, Port-B latency 1, no output register.
//
// write_bank and read_bank are independent, therefore software/testbench can
// fill the free bank while Conv1 reads the active bank.
// -----------------------------------------------------------------------------
module image_pingpong_bmg (
    input  wire        clk,
    input  wire        rst_n,

    input  wire        write_bank,
    input  wire        ext_we,
    input  wire [7:0]  ext_waddr,
    input  wire [31:0] ext_wdata,

    input  wire        read_bank,
    input  wire        int_ren,
    input  wire [7:0]  int_raddr,
    output wire [31:0] int_rdata,
    output wire        int_rvalid
);
    wire        ping_we;
    wire        pong_we;
    wire        ping_re;
    wire        pong_re;
    wire [31:0] ping_rdata;
    wire [31:0] pong_rdata;

    reg read_bank_d;
    reg read_valid_d;

    assign ping_we = ext_we && !write_bank;
    assign pong_we = ext_we &&  write_bank;
    assign ping_re = int_ren && !read_bank;
    assign pong_re = int_ren &&  read_bank;

    assign int_rdata  = read_bank_d ? pong_rdata : ping_rdata;
    assign int_rvalid = read_valid_d;

    lenet_image_bram u_image_ping (
        .clka  (clk),
        .ena   (ping_we),
        .wea   (ping_we),
        .addra (ext_waddr),
        .dina  (ext_wdata),
        .clkb  (clk),
        .enb   (ping_re),
        .addrb (int_raddr),
        .doutb (ping_rdata)
    );

    lenet_image_bram u_image_pong (
        .clka  (clk),
        .ena   (pong_we),
        .wea   (pong_we),
        .addra (ext_waddr),
        .dina  (ext_wdata),
        .clkb  (clk),
        .enb   (pong_re),
        .addrb (int_raddr),
        .doutb (pong_rdata)
    );

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            read_bank_d  <= 1'b0;
            read_valid_d <= 1'b0;
        end else begin
            read_valid_d <= int_ren;
            if (int_ren)
                read_bank_d <= read_bank;
        end
    end
endmodule

```



<h5 class="lenet-original-heading">conv1_engine_50dsp.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// Conv1, 50 DSP lanes, decoupled window generator and MAC consumer.
//
// Arithmetic is unchanged:
//   - two output channels per cycle
//   - 25 signed int8 multipliers per output channel
//   - 48-bit pipelined reduction
//   - ReLU
//   - 2x2 max-pooling
//
// Timing revision:
//   The dot-result-to-Pool1-write path is split into five registered stages.
//   Initiation interval remains one result per clock; only tail latency grows.
//
// Performance change:
//   The image/window generator no longer stops while channels 2 and 3 are
//   evaluated. Every valid 5x5 window is pushed into a 256-entry BMG FIFO.
//   The 50-DSP consumer independently removes one window and evaluates:
//       cycle A: output channels 0,1
//       cycle B: output channels 2,3
//
// The module interface is identical to the previous conv1_engine_50dsp,
// therefore lenet_v2.v, Conv2, FC and the testbenches do not need port changes.
// -----------------------------------------------------------------------------
module conv1_engine_50dsp (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    output reg         busy,
    output reg         done,
    output reg         overflow_error,

    output wire        image_ren,
    output wire [7:0]  image_raddr,
    input  wire [31:0] image_rdata,
    input  wire        image_rvalid,

    input  wire [24:0] weight_tap_we,
    input  wire [31:0] weight_tap_wdata,

    output reg         p1_we,
    output reg         p1_group,
    output reg  [7:0]  p1_waddr,
    output reg  [3:0]  p1_wrow,
    output reg  [3:0]  p1_wcol,
    output reg  [15:0] p1_wdata0,
    output reg  [15:0] p1_wdata1
);

    localparam TAG_W = 11;

    localparam [1:0] E_IDLE  = 2'd0;
    localparam [1:0] E_RUN   = 2'd1;
    localparam [1:0] E_DRAIN = 2'd2;
    localparam [1:0] E_DONE  = 2'd3;

    localparam C_WAIT   = 1'b0;
    localparam C_GROUP1 = 1'b1;

    reg [1:0] engine_state;
    reg       consumer_state;

    // -------------------------------------------------------------------------
    // Conv1 weight storage: 25 independent full 32-bit tap registers.
    //
    // The loader-to-tap write path is split into five local 5-tap groups.
    // This is a preload-only timing boundary: inference throughput and the
    // Conv1 issue schedule are unchanged.  Data and one-hot write enables are
    // delayed together by one clock, so every tap receives the same word as in
    // the original implementation.
    // -------------------------------------------------------------------------
    wire [25*32-1:0] weight_tap_words;

    reg [24:0] weight_tap_we_q;
    reg [31:0] weight_wdata_g0_q;
    reg [31:0] weight_wdata_g1_q;
    reg [31:0] weight_wdata_g2_q;
    reg [31:0] weight_wdata_g3_q;
    reg [31:0] weight_wdata_g4_q;

    wire weight_group0_we;
    wire weight_group1_we;
    wire weight_group2_we;
    wire weight_group3_we;
    wire weight_group4_we;

    assign weight_group0_we = |weight_tap_we[4:0];
    assign weight_group1_we = |weight_tap_we[9:5];
    assign weight_group2_we = |weight_tap_we[14:10];
    assign weight_group3_we = |weight_tap_we[19:15];
    assign weight_group4_we = |weight_tap_we[24:20];

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            weight_tap_we_q   <= 25'd0;
            weight_wdata_g0_q <= 32'd0;
            weight_wdata_g1_q <= 32'd0;
            weight_wdata_g2_q <= 32'd0;
            weight_wdata_g3_q <= 32'd0;
            weight_wdata_g4_q <= 32'd0;
        end else begin
            weight_tap_we_q <= weight_tap_we;

            if (weight_group0_we)
                weight_wdata_g0_q <= weight_tap_wdata;
            if (weight_group1_we)
                weight_wdata_g1_q <= weight_tap_wdata;
            if (weight_group2_we)
                weight_wdata_g2_q <= weight_tap_wdata;
            if (weight_group3_we)
                weight_wdata_g3_q <= weight_tap_wdata;
            if (weight_group4_we)
                weight_wdata_g4_q <= weight_tap_wdata;
        end
    end

    genvar c1_wtap;
    generate
        for (c1_wtap = 0; c1_wtap < 25; c1_wtap = c1_wtap + 1) begin : G_C1_WEIGHT_TAPS
            if (c1_wtap < 5) begin : G_WG0
                conv1_weight_tap_reg u_weight_tap (
                    .clk   (clk),
                    .we    (weight_tap_we_q[c1_wtap]),
                    .wdata (weight_wdata_g0_q),
                    .rdata (weight_tap_words[c1_wtap*32 +: 32])
                );
            end else if (c1_wtap < 10) begin : G_WG1
                conv1_weight_tap_reg u_weight_tap (
                    .clk   (clk),
                    .we    (weight_tap_we_q[c1_wtap]),
                    .wdata (weight_wdata_g1_q),
                    .rdata (weight_tap_words[c1_wtap*32 +: 32])
                );
            end else if (c1_wtap < 15) begin : G_WG2
                conv1_weight_tap_reg u_weight_tap (
                    .clk   (clk),
                    .we    (weight_tap_we_q[c1_wtap]),
                    .wdata (weight_wdata_g2_q),
                    .rdata (weight_tap_words[c1_wtap*32 +: 32])
                );
            end else if (c1_wtap < 20) begin : G_WG3
                conv1_weight_tap_reg u_weight_tap (
                    .clk   (clk),
                    .we    (weight_tap_we_q[c1_wtap]),
                    .wdata (weight_wdata_g3_q),
                    .rdata (weight_tap_words[c1_wtap*32 +: 32])
                );
            end else begin : G_WG4
                conv1_weight_tap_reg u_weight_tap (
                    .clk   (clk),
                    .we    (weight_tap_we_q[c1_wtap]),
                    .wdata (weight_wdata_g4_q),
                    .rdata (weight_tap_words[c1_wtap*32 +: 32])
                );
            end
        end
    endgenerate

    // -------------------------------------------------------------------------
    // Sliding-window producer
    // -------------------------------------------------------------------------
    // Storage intent is explicit:
    // - line0..line3 are one-read/one-write asynchronous-read line memories,
    //   so force LUTRAM (distributed RAM). They are intentionally NOT reset;
    //   the first four image rows overwrite every location before any valid
    //   5x5 output window can consume the stored data.
    // - window is a 5x5 shift-register bank. All 25 entries are read/shifted
    //   together on each accepted pixel, so it must be implemented as registers,
    //   not inferred RAM.
    (* ram_style = "distributed" *) reg [7:0] line0 [0:27];
    (* ram_style = "distributed" *) reg [7:0] line1 [0:27];
    (* ram_style = "distributed" *) reg [7:0] line2 [0:27];
    (* ram_style = "distributed" *) reg [7:0] line3 [0:27];
    (* ram_style = "registers"   *) reg [7:0] window [0:24];

    reg        producer_active;
    reg        producer_done;

    reg [7:0]  request_addr;
    reg        read_pending;
    reg [31:0] current_word;
    reg [31:0] next_word;
    reg        current_valid;
    reg        next_valid;
    reg [1:0]  byte_sel;

    reg [4:0] scan_row;
    reg [4:0] scan_col;

    reg [7:0] current_pixel;
    reg [7:0] vertical [0:4];
    reg [25*8-1:0] shifted_window_flat;

    wire pixel_fire;
    wire valid_window;
    wire last_pixel;

    // -------------------------------------------------------------------------
    // Window FIFO
    // -------------------------------------------------------------------------
    wire         window_fifo_in_valid;
    wire         window_fifo_in_ready;
    wire [215:0] window_fifo_in_data;

    wire         window_fifo_out_valid;
    wire         window_fifo_out_ready;
    wire [215:0] window_fifo_out_data;

    wire         window_fifo_full;
    wire         window_fifo_empty;
    wire [8:0]   window_fifo_level;

    // -------------------------------------------------------------------------
    // MAC consumer
    // -------------------------------------------------------------------------
    reg [25*8-1:0] active_window;
    reg [4:0]      active_row;
    reg [4:0]      active_col;

    reg [25*8-1:0] activation_window_flat;
    reg [25*8-1:0] weight_flat0;
    reg [25*8-1:0] weight_flat1;

    // Local replicas of the two-cycle output-channel phase.  These are kept
    // separate from engine_state/consumer_state so the 400-bit weight-select
    // cone is not driven by a global FSM bit.  Each replica drives only five
    // taps (40 data bits) close to one dot-product lane.
    (* keep = "true", dont_touch = "true", max_fanout = 48 *)
    reg [4:0] weight_phase_lane0_q;
    (* keep = "true", dont_touch = "true", max_fanout = 48 *)
    reg [4:0] weight_phase_lane1_q;

    reg              dot_in_valid;
    reg [TAG_W-1:0]  dot_in_tag;

    wire              dot0_valid;
    wire              dot1_valid;
    wire [TAG_W-1:0]  dot0_tag;
    wire [TAG_W-1:0]  dot1_tag;
    wire signed [47:0] dot0_sum;
    wire signed [47:0] dot1_sum;

    reg [10:0] issued_count;
    reg [10:0] received_count;

    // -------------------------------------------------------------------------
    // Fused ReLU and Pool1 timing pipeline
    //
    // The original implementation drove p1_wdata* directly from dot*_sum.
    // That made one long path containing saturation, tag decode, a variable
    // Pool1 history read, and the max4 tree.  The stages below keep one-result-
    // per-cycle throughput while adding a few cycles of latency:
    //
    //   A. capture dot-product result/tag
    //   B. saturating ReLU
    //   C. Pool1 state access / capture four max operands
    //   D. registered max4 reduction
    //   E. registered Pool1 write interface
    // -------------------------------------------------------------------------

    // Pool1 previous-row storage is a streaming 24-deep SRL per channel.
    // Conv1 outputs arrive in column order, so random addressing is unnecessary:
    // after 24 shifts, the SRL output is exactly the value from the preceding
    // row at the same column.  This removes the 24-way FF write fanout while
    // preserving the existing cycle schedule and Pool1 result order.
    wire [15:0] pool_prev_ch0_q;
    wire [15:0] pool_prev_ch1_q;
    wire [15:0] pool_prev_ch2_q;
    wire [15:0] pool_prev_ch3_q;

    wire pool_shift_g0;
    wire pool_shift_g1;

    reg [15:0] pool_top_left_ch0;
    reg [15:0] pool_top_left_ch1;
    reg [15:0] pool_top_left_ch2;
    reg [15:0] pool_top_left_ch3;
    reg [15:0] pool_curr_left_ch0;
    reg [15:0] pool_curr_left_ch1;
    reg [15:0] pool_curr_left_ch2;
    reg [15:0] pool_curr_left_ch3;

    // Stage A: dot-product result capture.
    reg               dot_result_valid_q;
    reg signed [47:0] dot0_sum_q;
    reg signed [47:0] dot1_sum_q;
    reg [TAG_W-1:0]   dot_tag_q;
    reg               dot_last_q;

    // Stage B: registered ReLU/saturation result.
    reg               relu_valid_q;
    reg [TAG_W-1:0]   relu_tag_q;
    reg [15:0]        relu0_q;
    reg [15:0]        relu1_q;
    reg               relu_last_q;

    // Stage C: four operands for each of the two output channels.
    reg               reduce_valid_q;
    reg [15:0]        reduce_a0_q;
    reg [15:0]        reduce_b0_q;
    reg [15:0]        reduce_c0_q;
    reg [15:0]        reduce_d0_q;
    reg [15:0]        reduce_a1_q;
    reg [15:0]        reduce_b1_q;
    reg [15:0]        reduce_c1_q;
    reg [15:0]        reduce_d1_q;
    reg               reduce_group_q;
    reg [3:0]         reduce_row_q;
    reg [3:0]         reduce_col_q;
    reg [7:0]         reduce_addr_q;
    reg               reduce_last_q;

    // Stage D: registered max4 result waiting for the output register.
    reg               write_pending_q;
    reg               write_group_q;
    reg [3:0]         write_row_q;
    reg [3:0]         write_col_q;
    reg [7:0]         write_addr_q;
    reg [15:0]        write_data0_q;
    reg [15:0]        write_data1_q;
    reg               write_last_q;

    integer r;
    integer c;
    integer k;

    assign pool_shift_g0 = relu_valid_q && !relu_tag_q[10];
    assign pool_shift_g1 = relu_valid_q &&  relu_tag_q[10];

    pool_row_srl24x16 u_pool_prev_ch0 (
        .clk  (clk),
        .ce   (pool_shift_g0),
        .din  (relu0_q),
        .dout (pool_prev_ch0_q)
    );

    pool_row_srl24x16 u_pool_prev_ch1 (
        .clk  (clk),
        .ce   (pool_shift_g0),
        .din  (relu1_q),
        .dout (pool_prev_ch1_q)
    );

    pool_row_srl24x16 u_pool_prev_ch2 (
        .clk  (clk),
        .ce   (pool_shift_g1),
        .din  (relu0_q),
        .dout (pool_prev_ch2_q)
    );

    pool_row_srl24x16 u_pool_prev_ch3 (
        .clk  (clk),
        .ce   (pool_shift_g1),
        .din  (relu1_q),
        .dout (pool_prev_ch3_q)
    );

    // -------------------------------------------------------------------------
    // Producer control
    // -------------------------------------------------------------------------
    assign valid_window =
        (scan_row >= 5'd4) &&
        (scan_col >= 5'd4);

    assign last_pixel =
        (scan_row == 5'd27) &&
        (scan_col == 5'd27);

    // A pixel is consumed only when a valid output window can be accepted.
    // For border pixels no FIFO entry is generated, so FIFO full does not
    // unnecessarily stop the four-row/four-column priming region.
    assign pixel_fire =
        producer_active &&
        current_valid &&
        (!valid_window || window_fifo_in_ready);

    // Sequential BMG addresses are requested while the second local word slot
    // is free. One word contains four input pixels.
    assign image_ren =
        producer_active &&
        !read_pending &&
        !next_valid &&
        (request_addr < 8'd196);

    assign image_raddr = request_addr;

    assign window_fifo_in_valid =
        pixel_fire && valid_window;

    assign window_fifo_in_data = {
        6'd0,
        scan_row - 5'd4,
        scan_col - 5'd4,
        shifted_window_flat
    };

    // The FIFO entry is consumed while group 0 is issued. The complete window
    // and coordinates are registered for the following group-1 cycle.
    assign window_fifo_out_ready =
        (engine_state == E_RUN) &&
        (consumer_state == C_WAIT) &&
        window_fifo_out_valid;

    conv1_window_fifo_bmg u_conv1_window_fifo (
        .clk       (clk),
        .rst_n     (rst_n),

        .in_valid  (window_fifo_in_valid),
        .in_ready  (window_fifo_in_ready),
        .in_data   (window_fifo_in_data),

        .out_valid (window_fifo_out_valid),
        .out_ready (window_fifo_out_ready),
        .out_data  (window_fifo_out_data),

        .full      (window_fifo_full),
        .empty     (window_fifo_empty),
        .level     (window_fifo_level)
    );

    // -------------------------------------------------------------------------
    // Utility function
    // -------------------------------------------------------------------------
    function [15:0] max4_16;
        input [15:0] a;
        input [15:0] b0;
        input [15:0] c0;
        input [15:0] d;
        reg [15:0] m0;
        reg [15:0] m1;
        begin
            m0 = (a  > b0) ? a  : b0;
            m1 = (c0 > d ) ? c0 : d;
            max4_16 = (m0 > m1) ? m0 : m1;
        end
    endfunction

    // -------------------------------------------------------------------------
    // Combinational producer datapath
    // -------------------------------------------------------------------------
    always @* begin
        case (byte_sel)
            2'd0:
                current_pixel = current_word[7:0];

            2'd1:
                current_pixel = current_word[15:8];

            2'd2:
                current_pixel = current_word[23:16];

            default:
                current_pixel = current_word[31:24];
        endcase

        vertical[0] = line3[scan_col];
        vertical[1] = line2[scan_col];
        vertical[2] = line1[scan_col];
        vertical[3] = line0[scan_col];
        vertical[4] = current_pixel;

        // shifted_window_flat describes the 5x5 window after inserting the
        // current pixel. It is also exactly the value written into the FIFO.
        for (r = 0; r < 5; r = r + 1) begin
            for (c = 0; c < 5; c = c + 1) begin
                if (c < 4)
                    shifted_window_flat[(r*5+c)*8 +: 8]
                        = window[r*5+c+1];
                else
                    shifted_window_flat[(r*5+c)*8 +: 8]
                        = vertical[r];
            end
        end
    end

    // -------------------------------------------------------------------------
    // Combinational MAC issue path
    // -------------------------------------------------------------------------
    always @* begin
        dot_in_valid = 1'b0;
        dot_in_tag = {TAG_W{1'b0}};
        activation_window_flat = active_window;

        // engine_state gates only valid/control.  It no longer participates in
        // the wide weight-data mux that feeds the two dot25 input registers.
        if (
            (engine_state == E_RUN) &&
            (consumer_state == C_WAIT) &&
            window_fifo_out_valid
        ) begin
            dot_in_valid = 1'b1;

            activation_window_flat =
                window_fifo_out_data[199:0];

            dot_in_tag = {
                1'b0,
                window_fifo_out_data[209:205],
                window_fifo_out_data[204:200]
            };
        end else if (
            (engine_state == E_RUN) &&
            (consumer_state == C_GROUP1)
        ) begin
            dot_in_valid = 1'b1;

            activation_window_flat = active_window;

            dot_in_tag = {
                1'b1,
                active_row,
                active_col
            };
        end

        // Five physically independent phase replicas per lane.  k/5 is a
        // compile-time constant after loop unrolling, so each replica controls
        // only one five-tap cluster rather than the complete 400-bit bus.
        for (k = 0; k < 25; k = k + 1) begin
            weight_flat0[k*8 +: 8] =
                weight_phase_lane0_q[k/5]
                    ? weight_tap_words[k*32 + 16 +: 8]
                    : weight_tap_words[k*32 +  0 +: 8];

            weight_flat1[k*8 +: 8] =
                weight_phase_lane1_q[k/5]
                    ? weight_tap_words[k*32 + 24 +: 8]
                    : weight_tap_words[k*32 +  8 +: 8];
        end
    end

    // -------------------------------------------------------------------------
    // Two 25-tap lanes = 50 DSP multipliers
    // -------------------------------------------------------------------------
    dot25_pipeline #(
        .ACT_W     (8),
        .TAG_W     (TAG_W),
        .INPUT_REG (1)
    ) u_dot0 (
        .clk              (clk),
        .rst_n            (rst_n),
        .in_valid         (dot_in_valid),
        .in_tag           (dot_in_tag),
        .activations_flat (activation_window_flat),
        .weights_flat     (weight_flat0),
        .out_valid        (dot0_valid),
        .out_tag          (dot0_tag),
        .sum_out          (dot0_sum)
    );

    dot25_pipeline #(
        .ACT_W     (8),
        .TAG_W     (TAG_W),
        .INPUT_REG (1)
    ) u_dot1 (
        .clk              (clk),
        .rst_n            (rst_n),
        .in_valid         (dot_in_valid),
        .in_tag           (dot_in_tag),
        .activations_flat (activation_window_flat),
        .weights_flat     (weight_flat1),
        .out_valid        (dot1_valid),
        .out_tag          (dot1_tag),
        .sum_out          (dot1_sum)
    );

    // -------------------------------------------------------------------------
    // Sequential control and fused pooling
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            engine_state      <= E_IDLE;
            consumer_state    <= C_WAIT;
            weight_phase_lane0_q <= 5'b00000;
            weight_phase_lane1_q <= 5'b00000;

            busy              <= 1'b0;
            done              <= 1'b0;
            overflow_error    <= 1'b0;

            producer_active   <= 1'b0;
            producer_done     <= 1'b0;

            request_addr      <= 8'd0;
            read_pending      <= 1'b0;
            current_word      <= 32'd0;
            next_word         <= 32'd0;
            current_valid     <= 1'b0;
            next_valid        <= 1'b0;
            byte_sel          <= 2'd0;

            scan_row          <= 5'd0;
            scan_col          <= 5'd0;

            active_window     <= 200'd0;
            active_row        <= 5'd0;
            active_col        <= 5'd0;

            issued_count      <= 11'd0;
            received_count    <= 11'd0;

            p1_we             <= 1'b0;
            p1_group          <= 1'b0;
            p1_waddr          <= 8'd0;
            p1_wrow           <= 4'd0;
            p1_wcol           <= 4'd0;
            p1_wdata0         <= 16'd0;
            p1_wdata1         <= 16'd0;

            pool_top_left_ch0 <= 16'd0;
            pool_top_left_ch1 <= 16'd0;
            pool_top_left_ch2 <= 16'd0;
            pool_top_left_ch3 <= 16'd0;
            pool_curr_left_ch0 <= 16'd0;
            pool_curr_left_ch1 <= 16'd0;
            pool_curr_left_ch2 <= 16'd0;
            pool_curr_left_ch3 <= 16'd0;

            dot_result_valid_q <= 1'b0;
            dot0_sum_q         <= 48'sd0;
            dot1_sum_q         <= 48'sd0;
            dot_tag_q          <= {TAG_W{1'b0}};
            dot_last_q         <= 1'b0;

            relu_valid_q       <= 1'b0;
            relu_tag_q         <= {TAG_W{1'b0}};
            relu0_q            <= 16'd0;
            relu1_q            <= 16'd0;
            relu_last_q        <= 1'b0;

            reduce_valid_q     <= 1'b0;
            reduce_a0_q        <= 16'd0;
            reduce_b0_q        <= 16'd0;
            reduce_c0_q        <= 16'd0;
            reduce_d0_q        <= 16'd0;
            reduce_a1_q        <= 16'd0;
            reduce_b1_q        <= 16'd0;
            reduce_c1_q        <= 16'd0;
            reduce_d1_q        <= 16'd0;
            reduce_group_q     <= 1'b0;
            reduce_row_q       <= 4'd0;
            reduce_col_q       <= 4'd0;
            reduce_addr_q      <= 8'd0;
            reduce_last_q      <= 1'b0;

            write_pending_q    <= 1'b0;
            write_group_q      <= 1'b0;
            write_row_q        <= 4'd0;
            write_col_q        <= 4'd0;
            write_addr_q       <= 8'd0;
            write_data0_q      <= 16'd0;
            write_data1_q      <= 16'd0;
            write_last_q       <= 1'b0;
        end else begin
            done <= 1'b0;

            // -------------------------------------------------------------
            // Conv1 result / Pool1 timing pipeline
            // -------------------------------------------------------------

            // Stage E: drive only already-registered Pool1 write information.
            // The final result changes state only after its write pulse has
            // been presented for a full clock, so the downstream BMG observes
            // the last write before c1_done is generated.
            p1_we <= write_pending_q;
            if (write_pending_q) begin
                p1_group  <= write_group_q;
                p1_waddr  <= write_addr_q;
                p1_wrow   <= write_row_q;
                p1_wcol   <= write_col_q;
                p1_wdata0 <= write_data0_q;
                p1_wdata1 <= write_data1_q;

                if (write_last_q)
                    engine_state <= E_DONE;
            end

            // Stage D: max4 has its own register boundary.
            write_pending_q <= reduce_valid_q;
            if (reduce_valid_q) begin
                write_group_q <= reduce_group_q;
                write_addr_q  <= reduce_addr_q;
                write_row_q   <= reduce_row_q;
                write_col_q   <= reduce_col_q;
                write_data0_q <= max4_16(
                    reduce_a0_q,
                    reduce_b0_q,
                    reduce_c0_q,
                    reduce_d0_q
                );
                write_data1_q <= max4_16(
                    reduce_a1_q,
                    reduce_b1_q,
                    reduce_c1_q,
                    reduce_d1_q
                );
                write_last_q <= reduce_last_q;
            end

            // Stage C: update Pool1 state or register the four max operands.
            reduce_valid_q <= 1'b0;
            if (relu_valid_q) begin
                if (!relu_tag_q[5]) begin
                    // Even row values are shifted into the SRL row histories
                    // by pool_shift_g0/pool_shift_g1 above.
                end else if (!relu_tag_q[0]) begin
                    // Odd row, even column: remember the left pair.
                    if (!relu_tag_q[10]) begin
                        pool_top_left_ch0 <= pool_prev_ch0_q;
                        pool_top_left_ch1 <= pool_prev_ch1_q;
                        pool_curr_left_ch0 <= relu0_q;
                        pool_curr_left_ch1 <= relu1_q;
                    end else begin
                        pool_top_left_ch2 <= pool_prev_ch2_q;
                        pool_top_left_ch3 <= pool_prev_ch3_q;
                        pool_curr_left_ch2 <= relu0_q;
                        pool_curr_left_ch3 <= relu1_q;
                    end
                end else begin
                    // Odd row, odd column: capture max operands.  The large
                    // Pool1 history read is now isolated from the max4 tree.
                    reduce_valid_q <= 1'b1;
                    reduce_group_q <= relu_tag_q[10];
                    reduce_row_q   <= relu_tag_q[9:6];
                    reduce_col_q   <= relu_tag_q[4:1];
                    reduce_addr_q  <= relu_tag_q[9:6] * 8'd12
                                    + relu_tag_q[4:1];
                    reduce_last_q  <= relu_last_q;

                    if (!relu_tag_q[10]) begin
                        reduce_a0_q <= pool_top_left_ch0;
                        reduce_b0_q <= pool_prev_ch0_q;
                        reduce_c0_q <= pool_curr_left_ch0;
                        reduce_d0_q <= relu0_q;

                        reduce_a1_q <= pool_top_left_ch1;
                        reduce_b1_q <= pool_prev_ch1_q;
                        reduce_c1_q <= pool_curr_left_ch1;
                        reduce_d1_q <= relu1_q;
                    end else begin
                        reduce_a0_q <= pool_top_left_ch2;
                        reduce_b0_q <= pool_prev_ch2_q;
                        reduce_c0_q <= pool_curr_left_ch2;
                        reduce_d0_q <= relu0_q;

                        reduce_a1_q <= pool_top_left_ch3;
                        reduce_b1_q <= pool_prev_ch3_q;
                        reduce_c1_q <= pool_curr_left_ch3;
                        reduce_d1_q <= relu1_q;
                    end
                end
            end

            // Stage B: saturating ReLU.  This path ends at local registers.
            relu_valid_q <= dot_result_valid_q;
            if (dot_result_valid_q) begin
                relu_tag_q  <= dot_tag_q;
                relu_last_q <= dot_last_q;

                if (dot0_sum_q[47])
                    relu0_q <= 16'd0;
                else if (|dot0_sum_q[46:16])
                    relu0_q <= 16'hffff;
                else
                    relu0_q <= dot0_sum_q[15:0];

                if (dot1_sum_q[47])
                    relu1_q <= 16'd0;
                else if (|dot1_sum_q[46:16])
                    relu1_q <= 16'hffff;
                else
                    relu1_q <= dot1_sum_q[15:0];

                if (
                    (!dot0_sum_q[47] && |dot0_sum_q[46:16]) ||
                    (!dot1_sum_q[47] && |dot1_sum_q[46:16])
                ) begin
                    overflow_error <= 1'b1;
                end
            end

            // Stage A: capture the two dot lanes and their common tag.
            dot_result_valid_q <= dot0_valid && dot1_valid;
            if (dot0_valid && dot1_valid) begin
                dot0_sum_q <= dot0_sum;
                dot1_sum_q <= dot1_sum;
                dot_tag_q  <= dot0_tag;
                dot_last_q <= (received_count == 11'd1151);
                received_count <= received_count + 11'd1;
            end

            // -------------------------------------------------------------
            // Image BRAM request/response
            // -------------------------------------------------------------
            if (image_ren) begin
                read_pending <= 1'b1;
                request_addr <= request_addr + 8'd1;
            end

            if (image_rvalid) begin
                read_pending <= 1'b0;

                if (!current_valid) begin
                    current_word  <= image_rdata;
                    current_valid <= 1'b1;
                    byte_sel      <= 2'd0;
                end else begin
                    next_word  <= image_rdata;
                    next_valid <= 1'b1;
                end
            end

            // -------------------------------------------------------------
            // Producer: one pixel per cycle, independent of MAC group 1
            // -------------------------------------------------------------
            if (pixel_fire) begin
                line3[scan_col] <= line2[scan_col];
                line2[scan_col] <= line1[scan_col];
                line1[scan_col] <= line0[scan_col];
                line0[scan_col] <= current_pixel;

                for (r = 0; r < 5; r = r + 1) begin
                    window[r*5+0] <= window[r*5+1];
                    window[r*5+1] <= window[r*5+2];
                    window[r*5+2] <= window[r*5+3];
                    window[r*5+3] <= window[r*5+4];
                    window[r*5+4] <= vertical[r];
                end

                if (byte_sel == 2'd3) begin
                    byte_sel <= 2'd0;

                    if (next_valid) begin
                        current_word  <= next_word;
                        current_valid <= 1'b1;
                        next_valid    <= 1'b0;
                    end else begin
                        current_valid <= 1'b0;
                    end
                end else begin
                    byte_sel <= byte_sel + 2'd1;
                end

                if (last_pixel) begin
                    producer_active <= 1'b0;
                    producer_done   <= 1'b1;
                end else if (scan_col == 5'd27) begin
                    scan_col <= 5'd0;
                    scan_row <= scan_row + 5'd1;
                end else begin
                    scan_col <= scan_col + 5'd1;
                end
            end

            // -------------------------------------------------------------
            // Consumer: group 0 from FIFO, group 1 from held entry
            // -------------------------------------------------------------
            if (engine_state == E_RUN) begin
                if (
                    (consumer_state == C_WAIT) &&
                    window_fifo_out_valid
                ) begin
                    active_window <= window_fifo_out_data[199:0];
                    active_row    <= window_fifo_out_data[209:205];
                    active_col    <= window_fifo_out_data[204:200];

                    issued_count   <= issued_count + 11'd1;
                    consumer_state <= C_GROUP1;
                    weight_phase_lane0_q <= 5'b11111;
                    weight_phase_lane1_q <= 5'b11111;
                end else if (consumer_state == C_GROUP1) begin
                    issued_count <= issued_count + 11'd1;
                    consumer_state <= C_WAIT;
                    weight_phase_lane0_q <= 5'b00000;
                    weight_phase_lane1_q <= 5'b00000;

                    // 576 windows x 2 output-channel groups = 1152 issues.
                    if (issued_count == 11'd1151)
                        engine_state <= E_DRAIN;
                end
            end

            // -------------------------------------------------------------
            // Engine-level control
            // -------------------------------------------------------------
            case (engine_state)
                E_IDLE: begin
                    busy <= 1'b0;

                    if (start) begin
                        busy            <= 1'b1;
                        overflow_error  <= 1'b0;

                        producer_active <= 1'b1;
                        producer_done   <= 1'b0;

                        request_addr    <= 8'd0;
                        read_pending    <= 1'b0;
                        current_valid   <= 1'b0;
                        next_valid      <= 1'b0;
                        byte_sel        <= 2'd0;

                        scan_row        <= 5'd0;
                        scan_col        <= 5'd0;

                        consumer_state  <= C_WAIT;
                        weight_phase_lane0_q <= 5'b00000;
                        weight_phase_lane1_q <= 5'b00000;
                        issued_count    <= 11'd0;
                        received_count  <= 11'd0;

                        dot_result_valid_q <= 1'b0;
                        relu_valid_q       <= 1'b0;
                        reduce_valid_q     <= 1'b0;
                        write_pending_q    <= 1'b0;
                        p1_we              <= 1'b0;

                        engine_state    <= E_RUN;
                    end
                end

                E_RUN: begin
                    busy <= 1'b1;
                end

                E_DRAIN: begin
                    busy <= 1'b1;
                end

                E_DONE: begin
                    busy         <= 1'b0;
                    done         <= 1'b1;
                    engine_state <= E_IDLE;
                end

                default: begin
                    engine_state <= E_IDLE;
                    busy         <= 1'b0;
                end
            endcase
        end
    end

endmodule

// -----------------------------------------------------------------------------
// 24-deep x 16-bit streaming row history.  No reset is required: row 0 of
// every frame shifts 24 fresh values before row 1 reads the delayed outputs.
// The canonical shift-register form lets Vivado infer sixteen SRL32 resources
// instead of 384 flip-flops and a variable-index write network.
// -----------------------------------------------------------------------------
module pool_row_srl24x16 (
    input  wire        clk,
    input  wire        ce,
    input  wire [15:0] din,
    output wire [15:0] dout
);
    (* shreg_extract = "yes" *) reg [23:0] shift_bit [0:15];
    integer bit_index;

    always @(posedge clk) begin
        if (ce) begin
            for (bit_index = 0; bit_index < 16; bit_index = bit_index + 1)
                shift_bit[bit_index] <= {shift_bit[bit_index][22:0], din[bit_index]};
        end
    end

    genvar out_bit;
    generate
        for (out_bit = 0; out_bit < 16; out_bit = out_bit + 1) begin : G_SRL_OUT
            assign dout[out_bit] = shift_bit[out_bit][23];
        end
    endgenerate
endmodule

```



<h5 class="lenet-original-heading">pool_row_srl24x16.v</h5>



```verilog
// -----------------------------------------------------------------------------
// 24-deep x 16-bit streaming row history.  No reset is required: row 0 of
// every frame shifts 24 fresh values before row 1 reads the delayed outputs.
// The canonical shift-register form lets Vivado infer sixteen SRL32 resources
// instead of 384 flip-flops and a variable-index write network.
// -----------------------------------------------------------------------------
module pool_row_srl24x16 (
    input  wire        clk,
    input  wire        ce,
    input  wire [15:0] din,
    output wire [15:0] dout
);
    (* shreg_extract = "yes" *) reg [23:0] shift_bit [0:15];
    integer bit_index;

    always @(posedge clk) begin
        if (ce) begin
            for (bit_index = 0; bit_index < 16; bit_index = bit_index + 1)
                shift_bit[bit_index] <= {shift_bit[bit_index][22:0], din[bit_index]};
        end
    end

    genvar out_bit;
    generate
        for (out_bit = 0; out_bit < 16; out_bit = out_bit + 1) begin : G_SRL_OUT
            assign dout[out_bit] = shift_bit[out_bit][23];
        end
    endgenerate
endmodule
```



<h5 class="lenet-original-heading">conv1_window_fifo_bmg.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// Conv1 5x5-window FIFO backed by a Vivado Block Memory Generator IP.
//
// Required BMG component name:
//   lenet_c1_window_fifo_bram
//
// Required IP configuration:
//   Interface Type          : Native
//   Memory Type             : Simple Dual Port RAM
//   Common Clock            : Enabled
//   Port A Write Width      : 216
//   Port A Write Depth      : 256
//   Port B Read Width       : 216
//   Port B Read Depth       : 256
//   Byte Write Enable       : Disabled
//   ENA / ENB pins          : Enabled
//   Port-B output registers : Disabled
//   Port-B read latency     : 1
//
// Entry layout:
//   [215:210] : reserved
//   [209:205] : Conv1 output row    (0..23)
//   [204:200] : Conv1 output column (0..23)
//   [199:0]   : 25 unsigned 8-bit pixels
//
// The wrapper provides a ready/valid output. It requests the next BRAM entry
// while the current entry is consumed, so a new window can be supplied every
// two clocks without an additional FIFO bubble.
// -----------------------------------------------------------------------------
module conv1_window_fifo_bmg (
    input  wire         clk,
    input  wire         rst_n,

    input  wire         in_valid,
    output wire         in_ready,
    input  wire [215:0] in_data,

    output wire         out_valid,
    input  wire         out_ready,
    output wire [215:0] out_data,

    output wire         full,
    output wire         empty,
    output wire [8:0]   level
);

    reg [7:0] write_ptr;
    reg [7:0] read_ptr;

    // Entries still resident in BRAM and not yet requested by Port B.
    reg [8:0] memory_count;

    // All entries owned by the FIFO:
    // BRAM-resident + read-pending + output-buffer entry.
    reg [8:0] total_count;

    reg read_pending;
    reg output_valid;

    wire write_accept;
    wire pop_accept;
    wire read_issue;

    wire [215:0] bram_dout;

    assign full     = (total_count == 9'd256);
    assign empty    = (total_count == 9'd0);
    assign level    = total_count;
    assign in_ready = !full;

    assign write_accept = in_valid && in_ready;
    assign pop_accept   = output_valid && out_ready;

    // A new BRAM read may be issued when:
    // 1) no previous read is still waiting,
    // 2) an unread BRAM entry exists,
    // 3) the output slot is empty, or its current entry is consumed now.
    assign read_issue =
        !read_pending &&
        (memory_count != 9'd0) &&
        (!output_valid || pop_accept);

    assign out_valid = output_valid;
    assign out_data  = bram_dout;

    lenet_c1_window_fifo_bram u_lenet_c1_window_fifo_bram (
        .clka  (clk),
        .ena   (write_accept),
        .wea   (write_accept),
        .addra (write_ptr),
        .dina  (in_data),

        .clkb  (clk),
        .enb   (read_issue),
        .addrb (read_ptr),
        .doutb (bram_dout)
    );

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            write_ptr     <= 8'd0;
            read_ptr      <= 8'd0;
            memory_count  <= 9'd0;
            total_count   <= 9'd0;
            read_pending  <= 1'b0;
            output_valid  <= 1'b0;
        end else begin
            // -------------------------------------------------------------
            // BRAM write side
            // -------------------------------------------------------------
            if (write_accept)
                write_ptr <= write_ptr + 8'd1;

            // -------------------------------------------------------------
            // BRAM read request side
            // -------------------------------------------------------------
            if (read_issue)
                read_ptr <= read_ptr + 8'd1;

            // The BMG Port-B output is valid after its configured latency.
            // One additional local pending flag keeps out_valid aligned with
            // the stable BMG output in behavioral simulation and hardware.
            if (pop_accept)
                output_valid <= 1'b0;

            if (read_pending) begin
                output_valid <= 1'b1;
                read_pending <= 1'b0;
            end

            if (read_issue)
                read_pending <= 1'b1;

            // -------------------------------------------------------------
            // Count entries still waiting inside BRAM.
            // -------------------------------------------------------------
            case ({write_accept, read_issue})
                2'b10:
                    memory_count <= memory_count + 9'd1;

                2'b01:
                    memory_count <= memory_count - 9'd1;

                default:
                    memory_count <= memory_count;
            endcase

            // -------------------------------------------------------------
            // Total FIFO occupancy.
            // -------------------------------------------------------------
            case ({write_accept, pop_accept})
                2'b10:
                    total_count <= total_count + 9'd1;

                2'b01:
                    total_count <= total_count - 9'd1;

                default:
                    total_count <= total_count;
            endcase
        end
    end

endmodule

```



<h5 class="lenet-original-heading">dot25_pipeline.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// Fully pipelined 25-term dot product, pure Verilog-2001.
//
// INPUT_REG = 0:
//   Original latency and datapath. Used by Conv1.
//
// INPUT_REG = 1:
//   Registers activation, weight, valid, and tag inputs before the multiplier
//   stage. Used by Conv2 to cut the timing path from window/weight selection
//   logic to the DSP48 A/B inputs.
//
// The optional input stage adds one clock of latency but does not change the
// initiation interval. One new dot-product request can still be accepted on
// every clock.
// -----------------------------------------------------------------------------
module dot25_pipeline #(
    parameter ACT_W     = 8,
    parameter TAG_W     = 16,
    parameter SUM_W     = 48,
    parameter INPUT_REG = 0
) (
    input  wire                      clk,
    input  wire                      rst_n,
    input  wire                      in_valid,
    input  wire [TAG_W-1:0]          in_tag,
    input  wire [25*ACT_W-1:0]       activations_flat,
    input  wire [25*8-1:0]           weights_flat,
    output wire                      out_valid,
    output wire [TAG_W-1:0]          out_tag,
    output reg signed [SUM_W-1:0]    sum_out
);

    // Inputs actually consumed by the multiplier stage.
    wire                     mul_in_valid;
    wire [TAG_W-1:0]         mul_in_tag;
    wire [25*ACT_W-1:0]      mul_activations_flat;
    wire [25*8-1:0]          mul_weights_flat;

    // Optional timing boundary before the 25 multipliers.
    generate
        if (INPUT_REG != 0) begin : G_INPUT_REGISTER
            reg                    input_valid_reg;
            reg [TAG_W-1:0]        input_tag_reg;
            reg [25*ACT_W-1:0]     input_activations_reg;
            reg [25*8-1:0]         input_weights_reg;

            always @(posedge clk or negedge rst_n) begin
                if (!rst_n) begin
                    input_valid_reg       <= 1'b0;
                    input_tag_reg         <= {TAG_W{1'b0}};
                    input_activations_reg <= {25*ACT_W{1'b0}};
                    input_weights_reg     <= {25*8{1'b0}};
                end else begin
                    input_valid_reg       <= in_valid;
                    input_tag_reg         <= in_tag;
                    input_activations_reg <= activations_flat;
                    input_weights_reg     <= weights_flat;
                end
            end

            assign mul_in_valid         = input_valid_reg;
            assign mul_in_tag           = input_tag_reg;
            assign mul_activations_flat = input_activations_reg;
            assign mul_weights_flat     = input_weights_reg;
        end else begin : G_INPUT_BYPASS
            assign mul_in_valid         = in_valid;
            assign mul_in_tag           = in_tag;
            assign mul_activations_flat = activations_flat;
            assign mul_weights_flat     = weights_flat;
        end
    endgenerate

    // 25 DSP products and a balanced registered adder tree.
    (* use_dsp = "yes" *)
    reg signed [SUM_W-1:0] prod [0:24];

    reg signed [SUM_W-1:0] s1 [0:12];
    reg signed [SUM_W-1:0] s2 [0:6];
    reg signed [SUM_W-1:0] s3 [0:3];
    reg signed [SUM_W-1:0] s4 [0:1];

    // Six clocks from multiplier capture to sum_out.
    // When INPUT_REG=1, the optional input stage is before this pipeline,
    // so valid/tag automatically gain the same additional one-clock latency.
    reg [5:0] valid_pipe;
    reg [TAG_W-1:0] tag_pipe [0:5];

    integer i;

    assign out_valid = valid_pipe[5];
    assign out_tag   = tag_pipe[5];

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            valid_pipe <= 6'd0;
            sum_out    <= {SUM_W{1'b0}};

            for (i = 0; i < 25; i = i + 1)
                prod[i] <= {SUM_W{1'b0}};

            for (i = 0; i < 13; i = i + 1)
                s1[i] <= {SUM_W{1'b0}};

            for (i = 0; i < 7; i = i + 1)
                s2[i] <= {SUM_W{1'b0}};

            for (i = 0; i < 4; i = i + 1)
                s3[i] <= {SUM_W{1'b0}};

            for (i = 0; i < 2; i = i + 1)
                s4[i] <= {SUM_W{1'b0}};

            for (i = 0; i < 6; i = i + 1)
                tag_pipe[i] <= {TAG_W{1'b0}};
        end else begin
            // Valid/tag pipeline. mul_in_* already includes the optional
            // one-clock input stage when INPUT_REG is enabled.
            valid_pipe[0] <= mul_in_valid;
            tag_pipe[0]   <= mul_in_tag;

            for (i = 1; i < 6; i = i + 1) begin
                valid_pipe[i] <= valid_pipe[i-1];
                tag_pipe[i]   <= tag_pipe[i-1];
            end

            // Registered multiplier stage.
            for (i = 0; i < 25; i = i + 1) begin
                prod[i] <=
                    $signed({
                        1'b0,
                        mul_activations_flat[
                            i*ACT_W +: ACT_W
                        ]
                    }) *
                    $signed(
                        mul_weights_flat[
                            i*8 +: 8
                        ]
                    );
            end

            // 25 -> 13
            for (i = 0; i < 12; i = i + 1)
                s1[i] <= prod[2*i] + prod[2*i+1];

            s1[12] <= prod[24];

            // 13 -> 7
            for (i = 0; i < 6; i = i + 1)
                s2[i] <= s1[2*i] + s1[2*i+1];

            s2[6] <= s1[12];

            // 7 -> 4
            s3[0] <= s2[0] + s2[1];
            s3[1] <= s2[2] + s2[3];
            s3[2] <= s2[4] + s2[5];
            s3[3] <= s2[6];

            // 4 -> 2
            s4[0] <= s3[0] + s3[1];
            s4[1] <= s3[2] + s3[3];

            // 2 -> 1
            sum_out <= s4[0] + s4[1];
        end
    end

endmodule

```



<h5 class="lenet-original-heading">conv1_weight_tap_reg.v</h5>



```verilog
`timescale 1ns/1ps

// One complete Conv1 tap: four signed int8 output-channel weights packed as
// {oc3, oc2, oc1, oc0}. Full-word writes avoid partial-write decode logic.
module conv1_weight_tap_reg (
    input  wire        clk,
    input  wire        we,
    input  wire [31:0] wdata,
    output wire [31:0] rdata
);
    reg [31:0] value;
    always @(posedge clk) begin
        if (we)
            value <= wdata;
    end
    assign rdata = value;
endmodule

```



<h5 class="lenet-original-heading">p1_pingpong_bmg.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// Pool1 Ping/Pong storage using two Vivado Block Memory Generator IPs.
//
// Required modules:
//   lenet_p1_ping_bram : 64-bit x 144, SDP, byte write enable, latency 1
//   lenet_p1_pong_bram : 64-bit x 144, SDP, byte write enable, latency 1
//
// write_bank and read_bank are independent so Conv1(frame N+1) can write one
// bank while Conv2(frame N) reads the other bank.
// -----------------------------------------------------------------------------
module p1_pingpong_bmg (
    input  wire        clk,
    input  wire        rst_n,

    input  wire        write_frame_start,
    input  wire        write_bank,
    input  wire        write_enable,
    input  wire        write_group,
    input  wire [7:0]  write_addr,
    input  wire [3:0]  write_row,
    input  wire [3:0]  write_col,
    input  wire [15:0] write_data0,
    input  wire [15:0] write_data1,

    input  wire        read_bank,
    input  wire        read_en,
    input  wire [7:0]  read_addr,
    output wire        read_valid,
    output wire [63:0] read_data,
    output wire [11:0] row_ready
);
    reg [11:0] ready_ping;
    reg [11:0] ready_pong;
    reg        read_bank_d;
    reg        read_valid_d;

    wire [63:0] packed_write_data;
    wire [7:0]  ping_wea;
    wire [7:0]  pong_wea;
    wire        ping_enb;
    wire        pong_enb;
    wire [63:0] ping_doutb;
    wire [63:0] pong_doutb;

    // For group 0 only the lower 32 bits are written. For group 1 only the
    // upper 32 bits are written. Replicating the pair makes either half valid.
    assign packed_write_data = {
        write_data1, write_data0,
        write_data1, write_data0
    };

    assign ping_wea = (write_enable && !write_bank)
                    ? (write_group ? 8'hF0 : 8'h0F)
                    : 8'h00;
    assign pong_wea = (write_enable &&  write_bank)
                    ? (write_group ? 8'hF0 : 8'h0F)
                    : 8'h00;

    assign ping_enb = read_en && !read_bank;
    assign pong_enb = read_en &&  read_bank;

    assign read_data  = read_bank_d ? pong_doutb : ping_doutb;
    assign read_valid = read_valid_d;
    assign row_ready  = read_bank ? ready_pong : ready_ping;

    lenet_p1_ping_bram u_lenet_p1_ping_bram (
        .clka  (clk),
        .ena   (|ping_wea),
        .wea   (ping_wea),
        .addra (write_addr),
        .dina  (packed_write_data),
        .clkb  (clk),
        .enb   (ping_enb),
        .addrb (read_addr),
        .doutb (ping_doutb)
    );

    lenet_p1_pong_bram u_lenet_p1_pong_bram (
        .clka  (clk),
        .ena   (|pong_wea),
        .wea   (pong_wea),
        .addra (write_addr),
        .dina  (packed_write_data),
        .clkb  (clk),
        .enb   (pong_enb),
        .addrb (read_addr),
        .doutb (pong_doutb)
    );

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            ready_ping   <= 12'd0;
            ready_pong   <= 12'd0;
            read_bank_d  <= 1'b0;
            read_valid_d <= 1'b0;
        end else begin
            read_valid_d <= read_en;
            if (read_en)
                read_bank_d <= read_bank;

            if (write_frame_start) begin
                if (write_bank)
                    ready_pong <= 12'd0;
                else
                    ready_ping <= 12'd0;
            end

            // Group 1 contains channels 2/3. At column 11 the whole row has all
            // four channels and can be consumed by Conv2.
            if (write_enable && write_group && (write_col == 4'd11)) begin
                if (write_bank)
                    ready_pong[write_row] <= 1'b1;
                else
                    ready_ping[write_row] <= 1'b1;
            end
        end
    end
endmodule

```



<h5 class="lenet-original-heading">conv2_engine_100dsp.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// Conv2, 100 DSP lanes, single Pool1 scan, timing-pipelined post processing.
//
// Four output channels are evaluated in parallel. For each valid 5x5x4 input
// window, the engine issues:
//   group 0, IC 0..3  -> output channels 0..3
//   group 1, IC 0..3  -> output channels 4..7
//   group 2, IC 0..3  -> output channels 8..11
// Total: 12 issue cycles per spatial position.
//
// Timing-critical Conv2 processing keeps the existing dot25 pipeline.
// Pool2 state is additionally banked by fixed output group and lane so the
// post_col signal selects only an eight-entry local row buffer.
//
// Conv2 return processing is split into four stages:
//   A. dot25 outputs -> local return registers
//   B. input-channel accumulation -> final-sum registers
//   B2. ReLU/saturation -> compact 96-bit data register
//   C. Pool2 -> pooled-result registers
//   D. four-entry serializer -> FC stream
//
// This removes the former long path from dot tag / accumulator registers
// through saturation, pooling and emit-data selection in one 8 ns cycle.
// External ports are unchanged, so lenet_v2.v does not need modification.
// -----------------------------------------------------------------------------
module conv2_engine_100dsp (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    output reg         busy,
    output reg         done,
    output reg         overflow_error,

    input  wire [24:0] weight_tap_we,
    input  wire [3:0]  weight_bank_waddr,
    input  wire [31:0] weight_bank_wdata,

    output wire        p1_read_en,
    output wire [7:0]  p1_read_addr,
    input  wire        p1_read_valid,
    input  wire [63:0] p1_read_data,
    input  wire [11:0] p1_row_ready,

    output reg         p2_valid,
    output reg  [7:0]  p2_flat_index,
    output reg  [23:0] p2_activation
);

    localparam TAG_W = 10;

    localparam [2:0] C2_IDLE      = 3'd0;
    localparam [2:0] C2_STREAM    = 3'd1;
    localparam [2:0] C2_ISSUE     = 3'd2;
    localparam [2:0] C2_DRAIN     = 3'd3;
    localparam [2:0] C2_WAIT_EMIT = 3'd4;
    localparam [2:0] C2_DONE      = 3'd5;

    reg [2:0] state;

    // -------------------------------------------------------------------------
    // Local Conv2 start replicas.
    //
    // The top-level c2_start pulse now drives only four local flip-flops.
    // Each replica controls a limited region of the Conv2 engine, preventing
    // one start net from becoming the select/control input of more than one
    // thousand registers after synthesis.
    //
    // KEEP/DONT_TOUCH prevent synthesis from merging the equivalent replicas.
    // -------------------------------------------------------------------------
    (* keep = "true", dont_touch = "true", max_fanout = 64 *)
    reg start_ctrl_q;

    (* keep = "true", dont_touch = "true", max_fanout = 64 *)
    reg start_fifo_q;

    (* keep = "true", dont_touch = "true", max_fanout = 64 *)
    reg start_issue_q;

    (* keep = "true", dont_touch = "true", max_fanout = 64 *)
    reg start_pipe_q;

    // -------------------------------------------------------------------------
    // Five local Conv2 weight-write command groups.
    // Loader command -> group register -> bank-local register -> LUTRAM.
    // -------------------------------------------------------------------------
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [4:0] weight_group_we0;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [4:0] weight_group_we1;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [4:0] weight_group_we2;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [4:0] weight_group_we3;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [4:0] weight_group_we4;

    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [3:0] weight_group_addr0;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [3:0] weight_group_addr1;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [3:0] weight_group_addr2;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [3:0] weight_group_addr3;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [3:0] weight_group_addr4;

    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [31:0] weight_group_data0;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [31:0] weight_group_data1;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [31:0] weight_group_data2;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [31:0] weight_group_data3;
    (* keep = "true", dont_touch = "true", max_fanout = 8 *)
    reg [31:0] weight_group_data4;

    // -------------------------------------------------------------------------
    // 25 independent tap banks.
    // Each bank contains 12 words:
    //   address = {output_group[1:0], input_channel[1:0]}
    // Each 32-bit word packs four int8 output-lane weights.
    // -------------------------------------------------------------------------
    wire [25*32-1:0] weight_tap_words;
    wire [3:0]       weight_read_addr;

    assign weight_read_addr = {issue_group, issue_ic};

    genvar c2_wtap;
    generate
        for (c2_wtap = 0; c2_wtap < 25; c2_wtap = c2_wtap + 1) begin : G_C2_WEIGHT_TAPS
            if (c2_wtap < 5) begin : G_WEIGHT_GROUP0
                conv2_weight_tap_bank u_weight_tap_bank (
                    .clk(clk), .rst_n(rst_n),
                    .we(weight_group_we0[c2_wtap]),
                    .waddr(weight_group_addr0),
                    .wdata(weight_group_data0),
                    .raddr(weight_read_addr),
                    .rdata(weight_tap_words[c2_wtap*32 +: 32])
                );
            end else if (c2_wtap < 10) begin : G_WEIGHT_GROUP1
                conv2_weight_tap_bank u_weight_tap_bank (
                    .clk(clk), .rst_n(rst_n),
                    .we(weight_group_we1[c2_wtap-5]),
                    .waddr(weight_group_addr1),
                    .wdata(weight_group_data1),
                    .raddr(weight_read_addr),
                    .rdata(weight_tap_words[c2_wtap*32 +: 32])
                );
            end else if (c2_wtap < 15) begin : G_WEIGHT_GROUP2
                conv2_weight_tap_bank u_weight_tap_bank (
                    .clk(clk), .rst_n(rst_n),
                    .we(weight_group_we2[c2_wtap-10]),
                    .waddr(weight_group_addr2),
                    .wdata(weight_group_data2),
                    .raddr(weight_read_addr),
                    .rdata(weight_tap_words[c2_wtap*32 +: 32])
                );
            end else if (c2_wtap < 20) begin : G_WEIGHT_GROUP3
                conv2_weight_tap_bank u_weight_tap_bank (
                    .clk(clk), .rst_n(rst_n),
                    .we(weight_group_we3[c2_wtap-15]),
                    .waddr(weight_group_addr3),
                    .wdata(weight_group_data3),
                    .raddr(weight_read_addr),
                    .rdata(weight_tap_words[c2_wtap*32 +: 32])
                );
            end else begin : G_WEIGHT_GROUP4
                conv2_weight_tap_bank u_weight_tap_bank (
                    .clk(clk), .rst_n(rst_n),
                    .we(weight_group_we4[c2_wtap-20]),
                    .waddr(weight_group_addr4),
                    .wdata(weight_group_data4),
                    .raddr(weight_read_addr),
                    .rdata(weight_tap_words[c2_wtap*32 +: 32])
                );
            end
        end
    endgenerate

    // -------------------------------------------------------------------------
    // Pool1 line and 5x5 window buffers.
    // Flattened index conventions:
    //   lineX  : input_channel*12 + column
    //   window : input_channel*25 + kernel_tap
    // -------------------------------------------------------------------------
    // Storage intent is explicit. These banks have four-channel parallel
    // accesses and the 5x5 window is shifted in many locations at once. A
    // single/dual-port RAM cannot preserve that access pattern, so force FF
    // register banks instead of allowing RAM inference heuristics. The arrays
    // are intentionally not reset; the 4-row/4-column priming region fully
    // overwrites every value that can reach the first valid 5x5 window.
    (* ram_style = "registers" *) reg [15:0] line0 [0:47];
    (* ram_style = "registers" *) reg [15:0] line1 [0:47];
    (* ram_style = "registers" *) reg [15:0] line2 [0:47];
    (* ram_style = "registers" *) reg [15:0] line3 [0:47];
    (* ram_style = "registers" *) reg [15:0] window [0:99];

    // Pool2 state is physically split by output group and lane.
    // Each bank stores only the eight Conv2 columns for one fixed channel.
    // This removes the former 96-entry variable-index read and the
    // 12-channel variable-index write from the post_col critical path.
    // Pool2 previous-row banks need one synchronous write and one asynchronous
    // read per bank. That is a direct fit for distributed LUTRAM. They are not
    // reset: row 0 writes all eight columns before row 1 reads them.
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g0_l0 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g0_l1 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g0_l2 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g0_l3 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g1_l0 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g1_l1 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g1_l2 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g1_l3 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g2_l0 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g2_l1 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g2_l2 [0:7];
    (* ram_style = "distributed" *) reg [23:0] pool_prev_g2_l3 [0:7];

    reg [23:0] pool_top_left_g0_l0;
    reg [23:0] pool_top_left_g0_l1;
    reg [23:0] pool_top_left_g0_l2;
    reg [23:0] pool_top_left_g0_l3;
    reg [23:0] pool_top_left_g1_l0;
    reg [23:0] pool_top_left_g1_l1;
    reg [23:0] pool_top_left_g1_l2;
    reg [23:0] pool_top_left_g1_l3;
    reg [23:0] pool_top_left_g2_l0;
    reg [23:0] pool_top_left_g2_l1;
    reg [23:0] pool_top_left_g2_l2;
    reg [23:0] pool_top_left_g2_l3;

    reg [23:0] pool_curr_left_g0_l0;
    reg [23:0] pool_curr_left_g0_l1;
    reg [23:0] pool_curr_left_g0_l2;
    reg [23:0] pool_curr_left_g0_l3;
    reg [23:0] pool_curr_left_g1_l0;
    reg [23:0] pool_curr_left_g1_l1;
    reg [23:0] pool_curr_left_g1_l2;
    reg [23:0] pool_curr_left_g1_l3;
    reg [23:0] pool_curr_left_g2_l0;
    reg [23:0] pool_curr_left_g2_l1;
    reg [23:0] pool_curr_left_g2_l2;
    reg [23:0] pool_curr_left_g2_l3;

    // -------------------------------------------------------------------------
    // Four-entry Pool1 prefetch FIFO.
    // -------------------------------------------------------------------------
    // Four-entry FIFO is intentionally a register bank. Depth is tiny and
    // explicit registers avoid any LUTRAM read-during-write collision semantics.
    (* ram_style = "registers" *) reg [63:0] fifo_mem [0:3];
    reg [1:0]  fifo_wr_ptr;
    reg [1:0]  fifo_rd_ptr;
    reg [2:0]  fifo_count;
    reg        read_outstanding;
    reg [3:0]  request_row;
    reg [3:0]  request_col;

    reg [3:0] scan_row;
    reg [3:0] scan_col;
    (* max_fanout = 16 *) reg [1:0] issue_group;
    (* max_fanout = 16 *) reg [1:0] issue_ic;
    reg [2:0] held_conv_row;
    reg [2:0] held_conv_col;
    reg       held_last_pixel;
    reg [9:0] received_count;

    reg [15:0] current_ch [0:3];
    reg [15:0] vertical   [0:19];
    reg [63:0] fifo_head;

    // -------------------------------------------------------------------------
    // dot25 issue buses.
    // -------------------------------------------------------------------------
    reg [25*16-1:0] activation_flat;
    reg [25*8-1:0]  weight_flat0;
    reg [25*8-1:0]  weight_flat1;
    reg [25*8-1:0]  weight_flat2;
    reg [25*8-1:0]  weight_flat3;

    reg              dot_in_valid;
    reg [TAG_W-1:0]  dot_in_tag;

    wire              dot0_valid;
    wire              dot1_valid;
    wire              dot2_valid;
    wire              dot3_valid;
    wire [TAG_W-1:0]  dot0_tag;
    wire [TAG_W-1:0]  dot1_tag;
    wire [TAG_W-1:0]  dot2_tag;
    wire [TAG_W-1:0]  dot3_tag;
    wire signed [47:0] dot0_sum;
    wire signed [47:0] dot1_sum;
    wire signed [47:0] dot2_sum;
    wire signed [47:0] dot3_sum;

    // -------------------------------------------------------------------------
    // Stage A: local return registers directly after dot25 pipelines.
    // These registers isolate the replicated tag pipeline and wide dot buses
    // from accumulator and pooling control fanout.
    // -------------------------------------------------------------------------
    reg               ret_valid;
    reg [TAG_W-1:0]   ret_tag;
    reg signed [47:0] ret_sum0;
    reg signed [47:0] ret_sum1;
    reg signed [47:0] ret_sum2;
    reg signed [47:0] ret_sum3;

    reg [1:0] ret_group;
    reg [2:0] ret_row;
    reg [2:0] ret_col;
    reg [1:0] ret_ic;
    reg [3:0] ret_ch0;
    reg [3:0] ret_ch1;
    reg [3:0] ret_ch2;
    reg [3:0] ret_ch3;

    // Input-channel accumulation for all twelve output channels.
    // Twelve channel accumulators are arithmetic state with multiple dynamic
    // writes per cycle. Force registers; this is not a RAM.
    (* ram_style = "registers" *) reg signed [47:0] accum [0:11];

    // -------------------------------------------------------------------------
    // Stage B: completed four-input-channel sums and local tags.
    // -------------------------------------------------------------------------
    (* max_fanout = 16 *) reg post_valid;
    (* max_fanout = 16 *) reg [2:0] post_row;
    (* max_fanout = 16 *) reg [2:0] post_col;
    (* max_fanout = 16 *) reg [1:0] post_group;
    reg signed [47:0] post_sum0;
    reg signed [47:0] post_sum1;
    reg signed [47:0] post_sum2;
    reg signed [47:0] post_sum3;

    // ReLU/saturation values derived only from Stage-B registers.
    reg [23:0] post_relu0;
    reg [23:0] post_relu1;
    reg [23:0] post_relu2;
    reg [23:0] post_relu3;

    // -------------------------------------------------------------------------
    // Stage B2: registered ReLU/saturation result.
    //
    // Only 96 data bits plus local metadata are added. The 100-DSP issue
    // schedule and initiation interval are unchanged. This register boundary
    // removes post_sum -> saturation -> Pool2-bank write from one cycle.
    // -------------------------------------------------------------------------
    reg        relu_valid;
    reg [2:0]  relu_row;
    reg [2:0]  relu_col;
    reg [1:0]  relu_group;
    reg [23:0] relu_data0;
    reg [23:0] relu_data1;
    reg [23:0] relu_data2;
    reg [23:0] relu_data3;

    // -------------------------------------------------------------------------
    // Stage C1: selected Pool2 operands. This separates dynamic array access
    // from the max-comparator tree and avoids the former long post_sum-to-data
    // path without introducing very wide DSP input registers.
    // -------------------------------------------------------------------------
    reg        pool_sel_valid;
    reg [23:0] pool_sel_a0;
    reg [23:0] pool_sel_b0;
    reg [23:0] pool_sel_c0;
    reg [23:0] pool_sel_d0;
    reg [23:0] pool_sel_a1;
    reg [23:0] pool_sel_b1;
    reg [23:0] pool_sel_c1;
    reg [23:0] pool_sel_d1;
    reg [23:0] pool_sel_a2;
    reg [23:0] pool_sel_b2;
    reg [23:0] pool_sel_c2;
    reg [23:0] pool_sel_d2;
    reg [23:0] pool_sel_a3;
    reg [23:0] pool_sel_b3;
    reg [23:0] pool_sel_c3;
    reg [23:0] pool_sel_d3;
    reg [7:0]  pool_sel_index0;
    reg [7:0]  pool_sel_index1;
    reg [7:0]  pool_sel_index2;
    reg [7:0]  pool_sel_index3;

    // -------------------------------------------------------------------------
    // Stage C2: registered pairwise maxima.
    // -------------------------------------------------------------------------
    reg        pool_pair_valid;
    reg [23:0] pool_pair_ab0;
    reg [23:0] pool_pair_cd0;
    reg [23:0] pool_pair_ab1;
    reg [23:0] pool_pair_cd1;
    reg [23:0] pool_pair_ab2;
    reg [23:0] pool_pair_cd2;
    reg [23:0] pool_pair_ab3;
    reg [23:0] pool_pair_cd3;
    reg [7:0]  pool_pair_index0;
    reg [7:0]  pool_pair_index1;
    reg [7:0]  pool_pair_index2;
    reg [7:0]  pool_pair_index3;

    // -------------------------------------------------------------------------
    // Stage C3: completed Pool2 values waiting for the serializer.
    // -------------------------------------------------------------------------
    reg        pool_out_valid;
    reg [23:0] pool_out_data0;
    reg [23:0] pool_out_data1;
    reg [23:0] pool_out_data2;
    reg [23:0] pool_out_data3;
    reg [7:0]  pool_out_index0;
    reg [7:0]  pool_out_index1;
    reg [7:0]  pool_out_index2;
    reg [7:0]  pool_out_index3;

    // -------------------------------------------------------------------------
    // Stage D: four-entry Pool2-to-FC serializer.
    // -------------------------------------------------------------------------
    reg        emit_active;
    reg [1:0]  emit_sel;
    reg [23:0] emit_data0;
    reg [23:0] emit_data1;
    reg [23:0] emit_data2;
    reg [23:0] emit_data3;
    reg [7:0]  emit_index0;
    reg [7:0]  emit_index1;
    reg [7:0]  emit_index2;
    reg [7:0]  emit_index3;

    wire pixel_fire;
    wire valid_window;
    wire last_pixel;
    wire fifo_push;
    wire fifo_pop;
    wire fifo_has_space;

    integer ch;
    integer r;
    integer c;
    integer k;
    integer lane;

    assign pixel_fire   = (state == C2_STREAM) && (fifo_count != 0);
    assign valid_window = (scan_row >= 4'd4) && (scan_col >= 4'd4);
    assign last_pixel   = (scan_row == 4'd11) && (scan_col == 4'd11);

    assign fifo_push      = p1_read_valid;
    assign fifo_pop       = pixel_fire;
    assign fifo_has_space = ((fifo_count + read_outstanding) < 4);

    assign p1_read_en = busy &&
                        (request_row < 4'd12) &&
                        p1_row_ready[request_row] &&
                        fifo_has_space;

    assign p1_read_addr = request_row*12 + request_col;

    function [23:0] max2_24;
        input [23:0] a;
        input [23:0] b0;
        begin
            max2_24 = (a > b0) ? a : b0;
        end
    endfunction

    function [23:0] max4_24;
        input [23:0] a;
        input [23:0] b0;
        input [23:0] c0;
        input [23:0] d;
        reg [23:0] m0;
        reg [23:0] m1;
        begin
            m0 = (a  > b0) ? a  : b0;
            m1 = (c0 > d ) ? c0 : d;
            max4_24 = (m0 > m1) ? m0 : m1;
        end
    endfunction

    // -------------------------------------------------------------------------
    // Combinational input/window and issue-bus generation.
    // -------------------------------------------------------------------------
    always @* begin
        fifo_head = fifo_mem[fifo_rd_ptr];

        current_ch[0] = fifo_head[15:0];
        current_ch[1] = fifo_head[31:16];
        current_ch[2] = fifo_head[47:32];
        current_ch[3] = fifo_head[63:48];

        for (ch = 0; ch < 4; ch = ch + 1) begin
            vertical[ch*5+0] = line3[ch*12+scan_col];
            vertical[ch*5+1] = line2[ch*12+scan_col];
            vertical[ch*5+2] = line1[ch*12+scan_col];
            vertical[ch*5+3] = line0[ch*12+scan_col];
            vertical[ch*5+4] = current_ch[ch];
        end

        for (r = 0; r < 5; r = r + 1) begin
            for (c = 0; c < 5; c = c + 1) begin
                activation_flat[(r*5+c)*16 +: 16] =
                    window[issue_ic*25 + r*5 + c];
            end
        end

        for (k = 0; k < 25; k = k + 1) begin
            weight_flat0[k*8 +: 8] =
                weight_tap_words[k*32 +: 8];

            weight_flat1[k*8 +: 8] =
                weight_tap_words[k*32 + 8 +: 8];

            weight_flat2[k*8 +: 8] =
                weight_tap_words[k*32 + 16 +: 8];

            weight_flat3[k*8 +: 8] =
                weight_tap_words[k*32 + 24 +: 8];
        end

        dot_in_valid = (state == C2_ISSUE);

        dot_in_tag = {
            issue_group,
            held_conv_row,
            held_conv_col,
            issue_ic
        };

        // Decode only the local Stage-A return register.
        ret_group = ret_tag[9:8];
        ret_row   = ret_tag[7:5];
        ret_col   = ret_tag[4:2];
        ret_ic    = ret_tag[1:0];

        ret_ch0 = {ret_group, 2'b00};
        ret_ch1 = {ret_group, 2'b00} + 4'd1;
        ret_ch2 = {ret_group, 2'b00} + 4'd2;
        ret_ch3 = {ret_group, 2'b00} + 4'd3;

        if (post_sum0[47])
            post_relu0 = 24'd0;
        else if (|post_sum0[46:24])
            post_relu0 = 24'hffffff;
        else
            post_relu0 = post_sum0[23:0];

        if (post_sum1[47])
            post_relu1 = 24'd0;
        else if (|post_sum1[46:24])
            post_relu1 = 24'hffffff;
        else
            post_relu1 = post_sum1[23:0];

        if (post_sum2[47])
            post_relu2 = 24'd0;
        else if (|post_sum2[46:24])
            post_relu2 = 24'hffffff;
        else
            post_relu2 = post_sum2[23:0];

        if (post_sum3[47])
            post_relu3 = 24'd0;
        else if (|post_sum3[46:24])
            post_relu3 = 24'hffffff;
        else
            post_relu3 = post_sum3[23:0];
    end

    // -------------------------------------------------------------------------
    // Four 25-tap dot-product pipelines = 100 multipliers.
    // -------------------------------------------------------------------------
    dot25_pipeline #(
        .ACT_W     (16),
        .TAG_W     (TAG_W),
        .INPUT_REG (1)
    ) u_dot0 (
        .clk              (clk),
        .rst_n            (rst_n),
        .in_valid         (dot_in_valid),
        .in_tag           (dot_in_tag),
        .activations_flat (activation_flat),
        .weights_flat     (weight_flat0),
        .out_valid        (dot0_valid),
        .out_tag          (dot0_tag),
        .sum_out          (dot0_sum)
    );

    dot25_pipeline #(
        .ACT_W     (16),
        .TAG_W     (TAG_W),
        .INPUT_REG (1)
    ) u_dot1 (
        .clk              (clk),
        .rst_n            (rst_n),
        .in_valid         (dot_in_valid),
        .in_tag           (dot_in_tag),
        .activations_flat (activation_flat),
        .weights_flat     (weight_flat1),
        .out_valid        (dot1_valid),
        .out_tag          (dot1_tag),
        .sum_out          (dot1_sum)
    );

    dot25_pipeline #(
        .ACT_W     (16),
        .TAG_W     (TAG_W),
        .INPUT_REG (1)
    ) u_dot2 (
        .clk              (clk),
        .rst_n            (rst_n),
        .in_valid         (dot_in_valid),
        .in_tag           (dot_in_tag),
        .activations_flat (activation_flat),
        .weights_flat     (weight_flat2),
        .out_valid        (dot2_valid),
        .out_tag          (dot2_tag),
        .sum_out          (dot2_sum)
    );

    dot25_pipeline #(
        .ACT_W     (16),
        .TAG_W     (TAG_W),
        .INPUT_REG (1)
    ) u_dot3 (
        .clk              (clk),
        .rst_n            (rst_n),
        .in_valid         (dot_in_valid),
        .in_tag           (dot_in_tag),
        .activations_flat (activation_flat),
        .weights_flat     (weight_flat3),
        .out_valid        (dot3_valid),
        .out_tag          (dot3_tag),
        .sum_out          (dot3_sum)
    );

    // -------------------------------------------------------------------------
    // Replicate Conv2 cache-write commands into five physical groups.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            weight_group_we0 <= 5'd0;
            weight_group_we1 <= 5'd0;
            weight_group_we2 <= 5'd0;
            weight_group_we3 <= 5'd0;
            weight_group_we4 <= 5'd0;

            weight_group_addr0 <= 4'd0;
            weight_group_addr1 <= 4'd0;
            weight_group_addr2 <= 4'd0;
            weight_group_addr3 <= 4'd0;
            weight_group_addr4 <= 4'd0;

            weight_group_data0 <= 32'd0;
            weight_group_data1 <= 32'd0;
            weight_group_data2 <= 32'd0;
            weight_group_data3 <= 32'd0;
            weight_group_data4 <= 32'd0;
        end else begin
            weight_group_we0 <= weight_tap_we[4:0];
            weight_group_we1 <= weight_tap_we[9:5];
            weight_group_we2 <= weight_tap_we[14:10];
            weight_group_we3 <= weight_tap_we[19:15];
            weight_group_we4 <= weight_tap_we[24:20];

            if (|weight_tap_we[4:0]) begin
                weight_group_addr0 <= weight_bank_waddr;
                weight_group_data0 <= weight_bank_wdata;
            end
            if (|weight_tap_we[9:5]) begin
                weight_group_addr1 <= weight_bank_waddr;
                weight_group_data1 <= weight_bank_wdata;
            end
            if (|weight_tap_we[14:10]) begin
                weight_group_addr2 <= weight_bank_waddr;
                weight_group_data2 <= weight_bank_wdata;
            end
            if (|weight_tap_we[19:15]) begin
                weight_group_addr3 <= weight_bank_waddr;
                weight_group_data3 <= weight_bank_wdata;
            end
            if (|weight_tap_we[24:20]) begin
                weight_group_addr4 <= weight_bank_waddr;
                weight_group_data4 <= weight_bank_wdata;
            end
        end
    end

    // -------------------------------------------------------------------------
    // Register and physically split the external start pulse.
    //
    // This adds one clock before Conv2 begins, but the PL timer includes it and
    // the steady-state dot-product initiation interval remains unchanged.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            start_ctrl_q  <= 1'b0;
            start_fifo_q  <= 1'b0;
            start_issue_q <= 1'b0;
            start_pipe_q  <= 1'b0;
        end else begin
            start_ctrl_q  <= start;
            start_fifo_q  <= start;
            start_issue_q <= start;
            start_pipe_q  <= start;
        end
    end

    // -------------------------------------------------------------------------
    // Sequential datapath and control.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state             <= C2_IDLE;
            busy              <= 1'b0;
            done              <= 1'b0;
            overflow_error    <= 1'b0;

            fifo_wr_ptr       <= 2'd0;
            fifo_rd_ptr       <= 2'd0;
            fifo_count        <= 3'd0;
            read_outstanding  <= 1'b0;
            request_row       <= 4'd0;
            request_col       <= 4'd0;

            scan_row          <= 4'd0;
            scan_col          <= 4'd0;
            issue_group       <= 2'd0;
            issue_ic          <= 2'd0;
            held_conv_row     <= 3'd0;
            held_conv_col     <= 3'd0;
            held_last_pixel   <= 1'b0;
            received_count    <= 10'd0;

            ret_valid         <= 1'b0;
            ret_tag           <= {TAG_W{1'b0}};
            ret_sum0          <= 48'sd0;
            ret_sum1          <= 48'sd0;
            ret_sum2          <= 48'sd0;
            ret_sum3          <= 48'sd0;

            post_valid        <= 1'b0;
            post_row          <= 3'd0;
            post_col          <= 3'd0;
            post_group        <= 2'd0;
            post_sum0         <= 48'sd0;
            post_sum1         <= 48'sd0;
            post_sum2         <= 48'sd0;
            post_sum3         <= 48'sd0;

            relu_valid        <= 1'b0;
            relu_row          <= 3'd0;
            relu_col          <= 3'd0;
            relu_group        <= 2'd0;
            relu_data0        <= 24'd0;
            relu_data1        <= 24'd0;
            relu_data2        <= 24'd0;
            relu_data3        <= 24'd0;

            pool_sel_valid    <= 1'b0;
            pool_sel_a0       <= 24'd0;
            pool_sel_b0       <= 24'd0;
            pool_sel_c0       <= 24'd0;
            pool_sel_d0       <= 24'd0;
            pool_sel_a1       <= 24'd0;
            pool_sel_b1       <= 24'd0;
            pool_sel_c1       <= 24'd0;
            pool_sel_d1       <= 24'd0;
            pool_sel_a2       <= 24'd0;
            pool_sel_b2       <= 24'd0;
            pool_sel_c2       <= 24'd0;
            pool_sel_d2       <= 24'd0;
            pool_sel_a3       <= 24'd0;
            pool_sel_b3       <= 24'd0;
            pool_sel_c3       <= 24'd0;
            pool_sel_d3       <= 24'd0;
            pool_sel_index0   <= 8'd0;
            pool_sel_index1   <= 8'd0;
            pool_sel_index2   <= 8'd0;
            pool_sel_index3   <= 8'd0;

            pool_pair_valid   <= 1'b0;
            pool_pair_ab0     <= 24'd0;
            pool_pair_cd0     <= 24'd0;
            pool_pair_ab1     <= 24'd0;
            pool_pair_cd1     <= 24'd0;
            pool_pair_ab2     <= 24'd0;
            pool_pair_cd2     <= 24'd0;
            pool_pair_ab3     <= 24'd0;
            pool_pair_cd3     <= 24'd0;
            pool_pair_index0  <= 8'd0;
            pool_pair_index1  <= 8'd0;
            pool_pair_index2  <= 8'd0;
            pool_pair_index3  <= 8'd0;

            pool_out_valid    <= 1'b0;
            pool_out_data0    <= 24'd0;
            pool_out_data1    <= 24'd0;
            pool_out_data2    <= 24'd0;
            pool_out_data3    <= 24'd0;
            pool_out_index0   <= 8'd0;
            pool_out_index1   <= 8'd0;
            pool_out_index2   <= 8'd0;
            pool_out_index3   <= 8'd0;

            emit_active       <= 1'b0;
            emit_sel          <= 2'd0;
            emit_data0        <= 24'd0;
            emit_data1        <= 24'd0;
            emit_data2        <= 24'd0;
            emit_data3        <= 24'd0;
            emit_index0       <= 8'd0;
            emit_index1       <= 8'd0;
            emit_index2       <= 8'd0;
            emit_index3       <= 8'd0;

            p2_valid          <= 1'b0;
            p2_flat_index     <= 8'd0;
            p2_activation     <= 24'd0;

            for (lane = 0; lane < 12; lane = lane + 1)
                accum[lane] <= 48'sd0;
        end else begin
            done           <= 1'b0;
            p2_valid       <= 1'b0;
            ret_valid      <= 1'b0;
            post_valid     <= 1'b0;
            relu_valid     <= 1'b0;
            pool_sel_valid  <= 1'b0;
            pool_pair_valid <= 1'b0;
            pool_out_valid  <= 1'b0;

            // -------------------------------------------------------------
            // Pool1 read request accounting.
            // -------------------------------------------------------------
            case ({p1_read_en, p1_read_valid})
                2'b10:
                    read_outstanding <= 1'b1;

                2'b01:
                    read_outstanding <= 1'b0;

                default:
                    read_outstanding <= read_outstanding;
            endcase

            if (p1_read_en) begin
                if (request_col == 4'd11) begin
                    request_col <= 4'd0;
                    request_row <= request_row + 4'd1;
                end else begin
                    request_col <= request_col + 4'd1;
                end
            end

            if (fifo_push) begin
                fifo_mem[fifo_wr_ptr] <= p1_read_data;
                fifo_wr_ptr <= fifo_wr_ptr + 2'd1;
            end

            if (fifo_pop)
                fifo_rd_ptr <= fifo_rd_ptr + 2'd1;

            case ({fifo_push, fifo_pop})
                2'b10:
                    fifo_count <= fifo_count + 3'd1;

                2'b01:
                    fifo_count <= fifo_count - 3'd1;

                default:
                    fifo_count <= fifo_count;
            endcase

            // -------------------------------------------------------------
            // Stage D: serialize one pooled activation per cycle.
            // -------------------------------------------------------------
            if (emit_active) begin
                p2_valid <= 1'b1;

                case (emit_sel)
                    2'd0: begin
                        p2_flat_index <= emit_index0;
                        p2_activation <= emit_data0;
                        emit_sel <= 2'd1;
                    end

                    2'd1: begin
                        p2_flat_index <= emit_index1;
                        p2_activation <= emit_data1;
                        emit_sel <= 2'd2;
                    end

                    2'd2: begin
                        p2_flat_index <= emit_index2;
                        p2_activation <= emit_data2;
                        emit_sel <= 2'd3;
                    end

                    default: begin
                        p2_flat_index <= emit_index3;
                        p2_activation <= emit_data3;
                        emit_active <= 1'b0;
                        emit_sel <= 2'd0;
                    end
                endcase
            end

            // Load the next four-value serializer packet.
            // A new packet is allowed in the cycle where the previous packet
            // emits entry 3, preserving one pooled group every four cycles.
            if (pool_out_valid) begin
                if (!emit_active || (emit_sel == 2'd3)) begin
                    emit_data0  <= pool_out_data0;
                    emit_data1  <= pool_out_data1;
                    emit_data2  <= pool_out_data2;
                    emit_data3  <= pool_out_data3;
                    emit_index0 <= pool_out_index0;
                    emit_index1 <= pool_out_index1;
                    emit_index2 <= pool_out_index2;
                    emit_index3 <= pool_out_index3;
                    emit_active <= 1'b1;
                    emit_sel    <= 2'd0;
                end else begin
                    // This should never occur because pooled groups are spaced
                    // four cycles apart. Keep the sticky error flag if it does.
                    overflow_error <= 1'b1;
                end
            end

            // -------------------------------------------------------------
            // Shift the four-channel Pool1 line/window buffer once per word.
            // -------------------------------------------------------------
            if (pixel_fire) begin
                for (ch = 0; ch < 4; ch = ch + 1) begin
                    line3[ch*12+scan_col] <= line2[ch*12+scan_col];
                    line2[ch*12+scan_col] <= line1[ch*12+scan_col];
                    line1[ch*12+scan_col] <= line0[ch*12+scan_col];
                    line0[ch*12+scan_col] <= current_ch[ch];

                    for (r = 0; r < 5; r = r + 1) begin
                        window[ch*25+r*5+0] <= window[ch*25+r*5+1];
                        window[ch*25+r*5+1] <= window[ch*25+r*5+2];
                        window[ch*25+r*5+2] <= window[ch*25+r*5+3];
                        window[ch*25+r*5+3] <= window[ch*25+r*5+4];
                        window[ch*25+r*5+4] <= vertical[ch*5+r];
                    end
                end

                if (!last_pixel) begin
                    if (scan_col == 4'd11) begin
                        scan_col <= 4'd0;
                        scan_row <= scan_row + 4'd1;
                    end else begin
                        scan_col <= scan_col + 4'd1;
                    end
                end

                if (valid_window) begin
                    // issue_group/issue_ic are already 0 here:
                    // - initialized to 0 at start
                    // - reset to 0 when the preceding 12-cycle issue sequence ends
                    // Removing the redundant assignments breaks the direct
                    // fifo_count -> pixel_fire -> issue counter D-input path.
                    held_conv_row   <= scan_row - 4'd4;
                    held_conv_col   <= scan_col - 4'd4;
                    held_last_pixel <= last_pixel;
                    state           <= C2_ISSUE;
                end else if (last_pixel) begin
                    state <= C2_DRAIN;
                end
            end

            // -------------------------------------------------------------
            // Stage A: capture dot pipeline outputs into local registers.
            // This directly breaks the former tag_pipe_reg -> Pool2 path.
            // -------------------------------------------------------------
            if (dot0_valid && dot1_valid && dot2_valid && dot3_valid) begin
                ret_valid <= 1'b1;
                ret_tag   <= dot0_tag;
                ret_sum0  <= dot0_sum;
                ret_sum1  <= dot1_sum;
                ret_sum2  <= dot2_sum;
                ret_sum3  <= dot3_sum;
            end

            // -------------------------------------------------------------
            // Stage B: input-channel accumulation.
            // For IC=3, write the completed sums and local tags to post regs.
            // -------------------------------------------------------------
            if (ret_valid) begin
                received_count <= received_count + 10'd1;

                case (ret_ic)
                    2'd0: begin
                        accum[ret_ch0] <= ret_sum0;
                        accum[ret_ch1] <= ret_sum1;
                        accum[ret_ch2] <= ret_sum2;
                        accum[ret_ch3] <= ret_sum3;
                    end

                    2'd1, 2'd2: begin
                        accum[ret_ch0] <= accum[ret_ch0] + ret_sum0;
                        accum[ret_ch1] <= accum[ret_ch1] + ret_sum1;
                        accum[ret_ch2] <= accum[ret_ch2] + ret_sum2;
                        accum[ret_ch3] <= accum[ret_ch3] + ret_sum3;
                    end

                    default: begin
                        post_valid <= 1'b1;
                        post_row   <= ret_row;
                        post_col   <= ret_col;
                        post_group <= ret_group;

                        post_sum0 <= accum[ret_ch0] + ret_sum0;
                        post_sum1 <= accum[ret_ch1] + ret_sum1;
                        post_sum2 <= accum[ret_ch2] + ret_sum2;
                        post_sum3 <= accum[ret_ch3] + ret_sum3;
                    end
                endcase
            end

            // -------------------------------------------------------------
            // Stage B2: register ReLU/saturation and metadata.
            // -------------------------------------------------------------
            if (post_valid) begin
                relu_valid <= 1'b1;
                relu_row   <= post_row;
                relu_col   <= post_col;
                relu_group <= post_group;
                relu_data0 <= post_relu0;
                relu_data1 <= post_relu1;
                relu_data2 <= post_relu2;
                relu_data3 <= post_relu3;

                if ((!post_sum0[47] && |post_sum0[46:24]) ||
                    (!post_sum1[47] && |post_sum1[46:24]) ||
                    (!post_sum2[47] && |post_sum2[46:24]) ||
                    (!post_sum3[47] && |post_sum3[46:24])) begin
                    overflow_error <= 1'b1;
                end
            end

            // -------------------------------------------------------------
            // Stage C1: Pool2 state selection from registered ReLU data.
            // Dynamic array accesses are registered before max comparison.
            // -------------------------------------------------------------
            if (relu_valid) begin
                // Pool2 is split into three fixed output groups. Inside a
                // group each lane has its own eight-entry previous-row bank
                // and scalar left-state registers. relu_col therefore selects
                // only one eight-entry bank and never a 96-entry global array.
                case (relu_group)
                    2'd0: begin
                        if (!relu_row[0]) begin
                            pool_prev_g0_l0[relu_col] <= relu_data0;
                            pool_prev_g0_l1[relu_col] <= relu_data1;
                            pool_prev_g0_l2[relu_col] <= relu_data2;
                            pool_prev_g0_l3[relu_col] <= relu_data3;
                        end else if (!relu_col[0]) begin
                            pool_top_left_g0_l0 <= pool_prev_g0_l0[relu_col];
                            pool_top_left_g0_l1 <= pool_prev_g0_l1[relu_col];
                            pool_top_left_g0_l2 <= pool_prev_g0_l2[relu_col];
                            pool_top_left_g0_l3 <= pool_prev_g0_l3[relu_col];

                            pool_curr_left_g0_l0 <= relu_data0;
                            pool_curr_left_g0_l1 <= relu_data1;
                            pool_curr_left_g0_l2 <= relu_data2;
                            pool_curr_left_g0_l3 <= relu_data3;
                        end else begin
                            pool_sel_valid <= 1'b1;

                            pool_sel_a0 <= pool_top_left_g0_l0;
                            pool_sel_b0 <= pool_prev_g0_l0[relu_col];
                            pool_sel_c0 <= pool_curr_left_g0_l0;
                            pool_sel_d0 <= relu_data0;

                            pool_sel_a1 <= pool_top_left_g0_l1;
                            pool_sel_b1 <= pool_prev_g0_l1[relu_col];
                            pool_sel_c1 <= pool_curr_left_g0_l1;
                            pool_sel_d1 <= relu_data1;

                            pool_sel_a2 <= pool_top_left_g0_l2;
                            pool_sel_b2 <= pool_prev_g0_l2[relu_col];
                            pool_sel_c2 <= pool_curr_left_g0_l2;
                            pool_sel_d2 <= relu_data2;

                            pool_sel_a3 <= pool_top_left_g0_l3;
                            pool_sel_b3 <= pool_prev_g0_l3[relu_col];
                            pool_sel_c3 <= pool_curr_left_g0_l3;
                            pool_sel_d3 <= relu_data3;

                            pool_sel_index0 <= {2'd0, 2'd0, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index1 <= {2'd0, 2'd1, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index2 <= {2'd0, 2'd2, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index3 <= {2'd0, 2'd3, relu_row[2:1], relu_col[2:1]};
                        end
                    end

                    2'd1: begin
                        if (!relu_row[0]) begin
                            pool_prev_g1_l0[relu_col] <= relu_data0;
                            pool_prev_g1_l1[relu_col] <= relu_data1;
                            pool_prev_g1_l2[relu_col] <= relu_data2;
                            pool_prev_g1_l3[relu_col] <= relu_data3;
                        end else if (!relu_col[0]) begin
                            pool_top_left_g1_l0 <= pool_prev_g1_l0[relu_col];
                            pool_top_left_g1_l1 <= pool_prev_g1_l1[relu_col];
                            pool_top_left_g1_l2 <= pool_prev_g1_l2[relu_col];
                            pool_top_left_g1_l3 <= pool_prev_g1_l3[relu_col];

                            pool_curr_left_g1_l0 <= relu_data0;
                            pool_curr_left_g1_l1 <= relu_data1;
                            pool_curr_left_g1_l2 <= relu_data2;
                            pool_curr_left_g1_l3 <= relu_data3;
                        end else begin
                            pool_sel_valid <= 1'b1;

                            pool_sel_a0 <= pool_top_left_g1_l0;
                            pool_sel_b0 <= pool_prev_g1_l0[relu_col];
                            pool_sel_c0 <= pool_curr_left_g1_l0;
                            pool_sel_d0 <= relu_data0;

                            pool_sel_a1 <= pool_top_left_g1_l1;
                            pool_sel_b1 <= pool_prev_g1_l1[relu_col];
                            pool_sel_c1 <= pool_curr_left_g1_l1;
                            pool_sel_d1 <= relu_data1;

                            pool_sel_a2 <= pool_top_left_g1_l2;
                            pool_sel_b2 <= pool_prev_g1_l2[relu_col];
                            pool_sel_c2 <= pool_curr_left_g1_l2;
                            pool_sel_d2 <= relu_data2;

                            pool_sel_a3 <= pool_top_left_g1_l3;
                            pool_sel_b3 <= pool_prev_g1_l3[relu_col];
                            pool_sel_c3 <= pool_curr_left_g1_l3;
                            pool_sel_d3 <= relu_data3;

                            pool_sel_index0 <= {2'd1, 2'd0, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index1 <= {2'd1, 2'd1, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index2 <= {2'd1, 2'd2, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index3 <= {2'd1, 2'd3, relu_row[2:1], relu_col[2:1]};
                        end
                    end

                    default: begin
                        if (!relu_row[0]) begin
                            pool_prev_g2_l0[relu_col] <= relu_data0;
                            pool_prev_g2_l1[relu_col] <= relu_data1;
                            pool_prev_g2_l2[relu_col] <= relu_data2;
                            pool_prev_g2_l3[relu_col] <= relu_data3;
                        end else if (!relu_col[0]) begin
                            pool_top_left_g2_l0 <= pool_prev_g2_l0[relu_col];
                            pool_top_left_g2_l1 <= pool_prev_g2_l1[relu_col];
                            pool_top_left_g2_l2 <= pool_prev_g2_l2[relu_col];
                            pool_top_left_g2_l3 <= pool_prev_g2_l3[relu_col];

                            pool_curr_left_g2_l0 <= relu_data0;
                            pool_curr_left_g2_l1 <= relu_data1;
                            pool_curr_left_g2_l2 <= relu_data2;
                            pool_curr_left_g2_l3 <= relu_data3;
                        end else begin
                            pool_sel_valid <= 1'b1;

                            pool_sel_a0 <= pool_top_left_g2_l0;
                            pool_sel_b0 <= pool_prev_g2_l0[relu_col];
                            pool_sel_c0 <= pool_curr_left_g2_l0;
                            pool_sel_d0 <= relu_data0;

                            pool_sel_a1 <= pool_top_left_g2_l1;
                            pool_sel_b1 <= pool_prev_g2_l1[relu_col];
                            pool_sel_c1 <= pool_curr_left_g2_l1;
                            pool_sel_d1 <= relu_data1;

                            pool_sel_a2 <= pool_top_left_g2_l2;
                            pool_sel_b2 <= pool_prev_g2_l2[relu_col];
                            pool_sel_c2 <= pool_curr_left_g2_l2;
                            pool_sel_d2 <= relu_data2;

                            pool_sel_a3 <= pool_top_left_g2_l3;
                            pool_sel_b3 <= pool_prev_g2_l3[relu_col];
                            pool_sel_c3 <= pool_curr_left_g2_l3;
                            pool_sel_d3 <= relu_data3;

                            pool_sel_index0 <= {2'd2, 2'd0, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index1 <= {2'd2, 2'd1, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index2 <= {2'd2, 2'd2, relu_row[2:1], relu_col[2:1]};
                            pool_sel_index3 <= {2'd2, 2'd3, relu_row[2:1], relu_col[2:1]};
                        end
                    end
                endcase
            end

            // -------------------------------------------------------------
            // Stage C2: pairwise max registers.
            // -------------------------------------------------------------
            if (pool_sel_valid) begin
                pool_pair_valid <= 1'b1;

                pool_pair_ab0 <= max2_24(pool_sel_a0, pool_sel_b0);
                pool_pair_cd0 <= max2_24(pool_sel_c0, pool_sel_d0);
                pool_pair_ab1 <= max2_24(pool_sel_a1, pool_sel_b1);
                pool_pair_cd1 <= max2_24(pool_sel_c1, pool_sel_d1);
                pool_pair_ab2 <= max2_24(pool_sel_a2, pool_sel_b2);
                pool_pair_cd2 <= max2_24(pool_sel_c2, pool_sel_d2);
                pool_pair_ab3 <= max2_24(pool_sel_a3, pool_sel_b3);
                pool_pair_cd3 <= max2_24(pool_sel_c3, pool_sel_d3);

                pool_pair_index0 <= pool_sel_index0;
                pool_pair_index1 <= pool_sel_index1;
                pool_pair_index2 <= pool_sel_index2;
                pool_pair_index3 <= pool_sel_index3;
            end

            // -------------------------------------------------------------
            // Stage C3: final max and Pool2 output registers.
            // -------------------------------------------------------------
            if (pool_pair_valid) begin
                pool_out_valid <= 1'b1;

                pool_out_data0 <= max2_24(pool_pair_ab0, pool_pair_cd0);
                pool_out_data1 <= max2_24(pool_pair_ab1, pool_pair_cd1);
                pool_out_data2 <= max2_24(pool_pair_ab2, pool_pair_cd2);
                pool_out_data3 <= max2_24(pool_pair_ab3, pool_pair_cd3);

                pool_out_index0 <= pool_pair_index0;
                pool_out_index1 <= pool_pair_index1;
                pool_out_index2 <= pool_pair_index2;
                pool_out_index3 <= pool_pair_index3;
            end

            // -------------------------------------------------------------
            // Main state machine.
            // -------------------------------------------------------------
            case (state)
                C2_IDLE: begin
                    busy <= 1'b0;

                    // Control region.
                    if (start_ctrl_q) begin
                        busy           <= 1'b1;
                        overflow_error <= 1'b0;
                        state          <= C2_STREAM;
                    end

                    // Pool1 prefetch/FIFO region.
                    if (start_fifo_q) begin
                        fifo_wr_ptr      <= 2'd0;
                        fifo_rd_ptr      <= 2'd0;
                        fifo_count       <= 3'd0;
                        read_outstanding <= 1'b0;
                        request_row      <= 4'd0;
                        request_col      <= 4'd0;
                    end

                    // Scan and issue region.
                    if (start_issue_q) begin
                        scan_row        <= 4'd0;
                        scan_col        <= 4'd0;
                        issue_group     <= 2'd0;
                        issue_ic        <= 2'd0;
                        held_conv_row   <= 3'd0;
                        held_conv_col   <= 3'd0;
                        held_last_pixel <= 1'b0;
                        received_count  <= 10'd0;
                    end

                    // Return/pooling/serializer pipeline region.
                    if (start_pipe_q) begin
                        ret_valid       <= 1'b0;
                        post_valid      <= 1'b0;
                        relu_valid      <= 1'b0;
                        pool_sel_valid  <= 1'b0;
                        pool_pair_valid <= 1'b0;
                        pool_out_valid  <= 1'b0;
                        emit_active    <= 1'b0;
                        emit_sel       <= 2'd0;
                    end
                end

                C2_STREAM: begin
                    busy <= 1'b1;
                    // Work is performed by pixel_fire above.
                end

                C2_ISSUE: begin
                    busy <= 1'b1;

                    if ((issue_group == 2'd2) &&
                        (issue_ic == 2'd3)) begin
                        issue_group <= 2'd0;
                        issue_ic    <= 2'd0;

                        if (held_last_pixel)
                            state <= C2_DRAIN;
                        else
                     
```



<h5 class="lenet-original-heading">conv2_weight_tap_bank.v</h5>



```verilog
`timescale 1ns/1ps

// -----------------------------------------------------------------------------
// One Conv2 kernel-tap weight bank.
//
// Depth 12:
//   3 output groups x 4 input channels
//
// Width 32:
//   Four signed int8 output-lane weights packed in one complete word.
//
// Timing structure:
//
//   Global loader command
//       -> local we/waddr/wdata registers
//       -> distributed RAM write port
//
// The previous global c2_bank_waddr register directly drove the write-address
// pins of all 25 x 32-bit LUTRAM banks, producing a fanout above one thousand.
// This module locally registers each bank's write command, so the global nets
// drive only 25 small register groups. The local address register then drives
// only its own bank.
//
// Writes are delayed by one clock, but a new command is accepted every clock.
// Conv2 loading is followed by the much longer FC loading phase, so all Conv2
// writes are committed well before weight_cache_loader asserts done.
// -----------------------------------------------------------------------------
module conv2_weight_tap_bank (
    input  wire        clk,
    input  wire        rst_n,

    input  wire        we,
    input  wire [3:0]  waddr,
    input  wire [31:0] wdata,

    input  wire [3:0]  raddr,
    output wire [31:0] rdata
);

    // Explicit LUTRAM: synchronous write, asynchronous read, no memory reset.
    // Only the command registers below are reset.
    (* ram_style = "distributed" *)
    reg [31:0] mem [0:11];

    // Preserve the local write boundary and keep each generated bank's
    // address/data registers physically independent.
    (* keep = "true", dont_touch = "true", max_fanout = 40 *)
    reg        local_we_q;

    (* keep = "true", dont_touch = "true", max_fanout = 40 *)
    reg [3:0]  local_waddr_q;

    (* keep = "true", dont_touch = "true", max_fanout = 40 *)
    reg [31:0] local_wdata_q;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            local_we_q    <= 1'b0;
            local_waddr_q <= 4'd0;
            local_wdata_q <= 32'd0;
        end else begin
            // Commit the command captured on the preceding clock.
            if (local_we_q)
                mem[local_waddr_q] <= local_wdata_q;

            // Capture the next command. Address/data are captured only for a
            // valid write, reducing unnecessary switching during inference.
            local_we_q <= we;

            if (we) begin
                local_waddr_q <= waddr;
                local_wdata_q <= wdata;
            end
        end
    end

    // Asynchronous distributed-RAM read used by the Conv2 issue pipeline.
    assign rdata = mem[raddr];

endmodule

```



<h5 class="lenet-original-heading">fc_engine_10dsp.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// Clean 192-to-10 fully-connected engine.
//
// Timing structure:
//   S0 : duplicate/register the LUTRAM read address and activation
//   S1 : register the ten LUTRAM outputs and activation
//   M0 : multiply directly into each lane's DSP product register
//   M1 : accumulate the registered product
//   M2 : register the final sum and generate the output logit
//
// The lane does not contain another activation/weight input register.  S1 is
// already the DSP input boundary.  The shared valid_s1 signal drives only one
// product_valid register per lane; it is never used as a clock-enable for the
// 24-bit activation or 8-bit weight data registers.
// -----------------------------------------------------------------------------
module fc_engine_10dsp (
    input  wire         clk,
    input  wire         rst_n,
    input  wire         start,
    output reg          busy,
    output reg          done,
    output reg          overflow_error,

    input  wire [9:0]   weight_class_we,
    input  wire [7:0]   weight_index,
    input  wire [7:0]   weight_data,

    input  wire         in_valid,
    input  wire [7:0]   in_flat_index,
    input  wire [23:0]  in_activation,

    output wire [319:0] logits_flat
);

    // -------------------------------------------------------------------------
    // Ten independent distributed-RAM weight banks.
    // -------------------------------------------------------------------------
    wire [7:0] weight0;
    wire [7:0] weight1;
    wire [7:0] weight2;
    wire [7:0] weight3;
    wire [7:0] weight4;
    wire [7:0] weight5;
    wire [7:0] weight6;
    wire [7:0] weight7;
    wire [7:0] weight8;
    wire [7:0] weight9;

    // S0: local address replicas.  These keep the Conv2 flat-index net from
    // directly driving all ten LUTRAM address trees.
    (* keep = "true" *) reg [7:0] read_index0_reg;
    (* keep = "true" *) reg [7:0] read_index1_reg;
    (* keep = "true" *) reg [7:0] read_index2_reg;
    (* keep = "true" *) reg [7:0] read_index3_reg;
    (* keep = "true" *) reg [7:0] read_index4_reg;
    (* keep = "true" *) reg [7:0] read_index5_reg;
    (* keep = "true" *) reg [7:0] read_index6_reg;
    (* keep = "true" *) reg [7:0] read_index7_reg;
    (* keep = "true" *) reg [7:0] read_index8_reg;
    (* keep = "true" *) reg [7:0] read_index9_reg;

    reg [23:0] activation_s0;
    reg        valid_s0;
    reg        last_s0;

    // S1: registered LUTRAM outputs.  These registers are the only data
    // boundary immediately before the ten DSP lanes.
    reg [7:0]  weight0_s1;
    reg [7:0]  weight1_s1;
    reg [7:0]  weight2_s1;
    reg [7:0]  weight3_s1;
    reg [7:0]  weight4_s1;
    reg [7:0]  weight5_s1;
    reg [7:0]  weight6_s1;
    reg [7:0]  weight7_s1;
    reg [7:0]  weight8_s1;
    reg [7:0]  weight9_s1;
    reg [23:0] activation_s1;
    reg        valid_s1;
    reg        last_s1;

    fc_weight_class_bank u_weight0 (
        .clk(clk), .we(weight_class_we[0]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index0_reg), .rdata(weight0)
    );
    fc_weight_class_bank u_weight1 (
        .clk(clk), .we(weight_class_we[1]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index1_reg), .rdata(weight1)
    );
    fc_weight_class_bank u_weight2 (
        .clk(clk), .we(weight_class_we[2]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index2_reg), .rdata(weight2)
    );
    fc_weight_class_bank u_weight3 (
        .clk(clk), .we(weight_class_we[3]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index3_reg), .rdata(weight3)
    );
    fc_weight_class_bank u_weight4 (
        .clk(clk), .we(weight_class_we[4]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index4_reg), .rdata(weight4)
    );
    fc_weight_class_bank u_weight5 (
        .clk(clk), .we(weight_class_we[5]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index5_reg), .rdata(weight5)
    );
    fc_weight_class_bank u_weight6 (
        .clk(clk), .we(weight_class_we[6]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index6_reg), .rdata(weight6)
    );
    fc_weight_class_bank u_weight7 (
        .clk(clk), .we(weight_class_we[7]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index7_reg), .rdata(weight7)
    );
    fc_weight_class_bank u_weight8 (
        .clk(clk), .we(weight_class_we[8]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index8_reg), .rdata(weight8)
    );
    fc_weight_class_bank u_weight9 (
        .clk(clk), .we(weight_class_we[9]),
        .waddr(weight_index), .wdata(weight_data),
        .raddr(read_index9_reg), .rdata(weight9)
    );

    reg  [7:0] receive_count;
    wire       input_last;

    assign input_last = (receive_count == 8'd191);

    // -------------------------------------------------------------------------
    // Ten independent MAC lanes.
    // The submodule name is unique so old fc_mac_lane files cannot silently
    // override this implementation through compile order.
    // -------------------------------------------------------------------------
    wire lane_valid0;
    wire lane_valid1;
    wire lane_valid2;
    wire lane_valid3;
    wire lane_valid4;
    wire lane_valid5;
    wire lane_valid6;
    wire lane_valid7;
    wire lane_valid8;
    wire lane_valid9;

    wire [31:0] logit0;
    wire [31:0] logit1;
    wire [31:0] logit2;
    wire [31:0] logit3;
    wire [31:0] logit4;
    wire [31:0] logit5;
    wire [31:0] logit6;
    wire [31:0] logit7;
    wire [31:0] logit8;
    wire [31:0] logit9;

    wire overflow0;
    wire overflow1;
    wire overflow2;
    wire overflow3;
    wire overflow4;
    wire overflow5;
    wire overflow6;
    wire overflow7;
    wire overflow8;
    wire overflow9;

    fc_mac_lane_direct u_lane0 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight0_s1),
        .final_valid(lane_valid0), .logit(logit0), .overflow(overflow0)
    );
    fc_mac_lane_direct u_lane1 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight1_s1),
        .final_valid(lane_valid1), .logit(logit1), .overflow(overflow1)
    );
    fc_mac_lane_direct u_lane2 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight2_s1),
        .final_valid(lane_valid2), .logit(logit2), .overflow(overflow2)
    );
    fc_mac_lane_direct u_lane3 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight3_s1),
        .final_valid(lane_valid3), .logit(logit3), .overflow(overflow3)
    );
    fc_mac_lane_direct u_lane4 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight4_s1),
        .final_valid(lane_valid4), .logit(logit4), .overflow(overflow4)
    );
    fc_mac_lane_direct u_lane5 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight5_s1),
        .final_valid(lane_valid5), .logit(logit5), .overflow(overflow5)
    );
    fc_mac_lane_direct u_lane6 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight6_s1),
        .final_valid(lane_valid6), .logit(logit6), .overflow(overflow6)
    );
    fc_mac_lane_direct u_lane7 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight7_s1),
        .final_valid(lane_valid7), .logit(logit7), .overflow(overflow7)
    );
    fc_mac_lane_direct u_lane8 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight8_s1),
        .final_valid(lane_valid8), .logit(logit8), .overflow(overflow8)
    );
    fc_mac_lane_direct u_lane9 (
        .clk(clk), .rst_n(rst_n), .start(start),
        .in_valid(valid_s1), .in_last(last_s1),
        .activation(activation_s1), .weight(weight9_s1),
        .final_valid(lane_valid9), .logit(logit9), .overflow(overflow9)
    );

    // -------------------------------------------------------------------------
    // S0/S1 timing-isolation pipeline.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            read_index0_reg <= 8'd0;
            read_index1_reg <= 8'd0;
            read_index2_reg <= 8'd0;
            read_index3_reg <= 8'd0;
            read_index4_reg <= 8'd0;
            read_index5_reg <= 8'd0;
            read_index6_reg <= 8'd0;
            read_index7_reg <= 8'd0;
            read_index8_reg <= 8'd0;
            read_index9_reg <= 8'd0;

            activation_s0 <= 24'd0;
            valid_s0      <= 1'b0;
            last_s0       <= 1'b0;

            weight0_s1    <= 8'd0;
            weight1_s1    <= 8'd0;
            weight2_s1    <= 8'd0;
            weight3_s1    <= 8'd0;
            weight4_s1    <= 8'd0;
            weight5_s1    <= 8'd0;
            weight6_s1    <= 8'd0;
            weight7_s1    <= 8'd0;
            weight8_s1    <= 8'd0;
            weight9_s1    <= 8'd0;
            activation_s1 <= 24'd0;
            valid_s1      <= 1'b0;
            last_s1       <= 1'b0;
        end else begin
            // S1 always advances.  valid_s0 identifies whether the sampled
            // LUTRAM output belongs to a real input activation.
            weight0_s1    <= weight0;
            weight1_s1    <= weight1;
            weight2_s1    <= weight2;
            weight3_s1    <= weight3;
            weight4_s1    <= weight4;
            weight5_s1    <= weight5;
            weight6_s1    <= weight6;
            weight7_s1    <= weight7;
            weight8_s1    <= weight8;
            weight9_s1    <= weight9;
            activation_s1 <= activation_s0;
            valid_s1      <= valid_s0;
            last_s1       <= last_s0;

            // Default bubble in S0 prevents replay while the lane pipeline
            // drains after the 192nd activation.
            valid_s0 <= 1'b0;
            last_s0  <= 1'b0;

            if (start) begin
                valid_s0 <= 1'b0;
                last_s0  <= 1'b0;
                valid_s1 <= 1'b0;
                last_s1  <= 1'b0;
            end else if (busy && in_valid) begin
                read_index0_reg <= in_flat_index;
                read_index1_reg <= in_flat_index;
                read_index2_reg <= in_flat_index;
                read_index3_reg <= in_flat_index;
                read_index4_reg <= in_flat_index;
                read_index5_reg <= in_flat_index;
                read_index6_reg <= in_flat_index;
                read_index7_reg <= in_flat_index;
                read_index8_reg <= in_flat_index;
                read_index9_reg <= in_flat_index;

                activation_s0 <= in_activation;
                valid_s0      <= 1'b1;
                last_s0       <= input_last;
            end
        end
    end

    assign logits_flat = {
        logit9, logit8, logit7, logit6, logit5,
        logit4, logit3, logit2, logit1, logit0
    };

    // -------------------------------------------------------------------------
    // Engine-level transaction control.
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            busy           <= 1'b0;
            done           <= 1'b0;
            overflow_error <= 1'b0;
            receive_count  <= 8'd0;
        end else begin
            done <= 1'b0;

            if (start) begin
                busy           <= 1'b1;
                overflow_error <= 1'b0;
                receive_count  <= 8'd0;
            end else begin
                if (busy && in_valid)
                    receive_count <= receive_count + 8'd1;

                if (lane_valid0) begin
                    busy <= 1'b0;
                    done <= 1'b1;

                    if (overflow0 || overflow1 || overflow2 || overflow3 ||
                        overflow4 || overflow5 || overflow6 || overflow7 ||
                        overflow8 || overflow9)
                        overflow_error <= 1'b1;
                end
            end
        end
    end

endmodule

```



<h5 class="lenet-original-heading">fc_weight_class_bank.v</h5>



```verilog
`timescale 1ns/1ps

// One FC output-class weight bank: 192 signed int8 weights.
module fc_weight_class_bank (
    input  wire       clk,
    input  wire       we,
    input  wire [7:0] waddr,
    input  wire [7:0] wdata,
    input  wire [7:0] raddr,
    output wire [7:0] rdata
);
    // Explicit LUTRAM: synchronous write, asynchronous read, no memory reset.
    (* ram_style = "distributed" *) reg [7:0] mem [0:191];
    always @(posedge clk) begin
        if (we)
            mem[waddr] <= wdata;
    end
    assign rdata = mem[raddr];
endmodule

```



<h5 class="lenet-original-heading">fc_mac_lane_direct.v</h5>



```verilog
`timescale 1ns/1ps
`include "lenet_params.vh"

// -----------------------------------------------------------------------------
// Direct-input FC MAC lane.
//
// product_reg is updated every cycle.  product_valid determines whether the
// previous product is accumulated.  Consequently in_valid is not synthesized
// as a clock-enable or D-input mux select for the 33-bit product datapath.
// -----------------------------------------------------------------------------
module fc_mac_lane_direct (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,

    input  wire        in_valid,
    input  wire        in_last,
    input  wire [23:0] activation,
    input  wire [7:0]  weight,

    output reg         final_valid,
    output reg  [31:0] logit,
    output reg         overflow
);

    reg signed [47:0] accum_reg;

    (* use_dsp = "yes" *)
    reg signed [32:0] product_reg;
    reg               product_valid;
    reg               product_last;

    reg signed [47:0] final_sum_reg;
    reg               final_pending;

    wire signed [24:0] activation_signed;
    wire signed [7:0]  weight_signed;
    wire signed [47:0] product_ext;
    wire signed [47:0] accum_next;

    assign activation_signed = $signed({1'b0, activation});
    assign weight_signed     = $signed(weight);
    assign product_ext       = {{15{product_reg[32]}}, product_reg};
    assign accum_next        = accum_reg + product_ext;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            accum_reg      <= 48'sd0;
            product_reg    <= 33'sd0;
            product_valid  <= 1'b0;
            product_last   <= 1'b0;
            final_sum_reg  <= 48'sd0;
            final_pending  <= 1'b0;
            final_valid    <= 1'b0;
            logit          <= 32'd0;
            overflow       <= 1'b0;
        end else begin
            // One-cycle pulses/control defaults.
            product_valid <= in_valid;
            product_last  <= in_last;
            final_pending <= 1'b0;
            final_valid   <= 1'b0;

            if (start) begin
                accum_reg      <= 48'sd0;
                product_valid  <= 1'b0;
                product_last   <= 1'b0;
                final_pending  <= 1'b0;
                final_valid    <= 1'b0;
                logit          <= 32'd0;
                overflow       <= 1'b0;
            end else begin
                // M0: no in_valid-controlled enable on the product datapath.
                product_reg <= activation_signed * weight_signed;

                // M1: consume the product registered on the previous cycle.
                if (product_valid) begin
                    if (product_last) begin
                        final_sum_reg <= accum_next;
                        final_pending <= 1'b1;
                    end else begin
                        accum_reg <= accum_next;
                    end
                end

                // M2: clip the completed sum to the unsigned 32-bit logit.
                if (final_pending) begin
                    final_valid <= 1'b1;

                    if (final_sum_reg[47:32] != {16{final_sum_reg[31]}})
                        overflow <= 1'b1;

                    if (final_sum_reg[47])
                        logit <= 32'd0;
                    else
                        logit <= final_sum_reg[31:0];
                end
            end
        end
    end

endmodule

```



<h5 class="lenet-original-heading">lenet_axis_wrapper.</h5>



```verilog
`timescale 1ns/1ps

// =============================================================================
// AXI4-Stream wrapper for lenet_v2
//
// Input packet format (32-bit words)
//   Weight packet:
//     Beat 0      : 32'h5747_5431 ("WGT1")
//     Beat 1..805 : weight words 0..804
//     TLAST       : asserted on weight word 804
//
//   Image packet:
//     Beat 0      : 32'h494D_4731 ("IMG1")
//     Beat 1..196 : image words 0..195
//     TLAST       : asserted on image word 195
//
// Output packet format (13 x 32-bit words)
//   Beat 0      : status
//   Beat 1..10  : logits 0..9
//   Beat 11     : cycle_count[31:0]
//   Beat 12     : cycle_count[63:32], TLAST=1
//
// The DMA S2MM channel should be started before the image MM2S transfer.
// =============================================================================
module lenet_axis_wrapper (
    // -------------------------------------------------------------------------
    // Clock / reset
    // -------------------------------------------------------------------------
    (* X_INTERFACE_INFO = "xilinx.com:signal:clock:1.0 aclk CLK" *)
    (* X_INTERFACE_PARAMETER = "XIL_INTERFACENAME aclk, ASSOCIATED_BUSIF S_AXIS:M_AXIS, ASSOCIATED_RESET aresetn, FREQ_HZ 125000000" *)
    input  wire        aclk,

    (* X_INTERFACE_INFO = "xilinx.com:signal:reset:1.0 aresetn RST" *)
    (* X_INTERFACE_PARAMETER = "XIL_INTERFACENAME aresetn, POLARITY ACTIVE_LOW" *)
    input  wire        aresetn,

    // -------------------------------------------------------------------------
    // AXI4-Stream input: AXI DMA MM2S -> wrapper
    // -------------------------------------------------------------------------
    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 S_AXIS TDATA" *)
    input  wire [31:0] s_axis_tdata,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 S_AXIS TKEEP" *)
    input  wire [3:0]  s_axis_tkeep,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 S_AXIS TVALID" *)
    input  wire        s_axis_tvalid,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 S_AXIS TREADY" *)
    output wire        s_axis_tready,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 S_AXIS TLAST" *)
    input  wire        s_axis_tlast,

    // -------------------------------------------------------------------------
    // AXI4-Stream output: wrapper -> AXI DMA S2MM
    // -------------------------------------------------------------------------
    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 M_AXIS TDATA" *)
    output reg  [31:0] m_axis_tdata,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 M_AXIS TKEEP" *)
    output wire [3:0]  m_axis_tkeep,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 M_AXIS TVALID" *)
    output wire        m_axis_tvalid,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 M_AXIS TREADY" *)
    input  wire        m_axis_tready,

    (* X_INTERFACE_INFO = "xilinx.com:interface:axis:1.0 M_AXIS TLAST" *)
    output wire        m_axis_tlast,

    // Optional debug outputs. They may be left unconnected in Block Design.
    output reg         protocol_error,
    output reg         result_overflow
);

    localparam [31:0] HEADER_WEIGHT = 32'h5747_5431; // "WGT1"
    localparam [31:0] HEADER_IMAGE  = 32'h494D_4731; // "IMG1"

    localparam [2:0] RX_HEADER       = 3'd0;
    localparam [2:0] RX_WEIGHT       = 3'd1;
    localparam [2:0] RX_IMAGE        = 3'd2;
    localparam [2:0] RX_IMG_COMMIT_1 = 3'd3;
    localparam [2:0] RX_IMG_COMMIT_2 = 3'd4;

    reg [2:0] rx_state;
    reg [9:0] weight_index;
    reg [7:0] image_index;

    // Native lenet_v2 inputs generated by the packet parser.
    reg         core_start;
    reg         core_image_we;
    reg  [7:0]  core_image_waddr;
    reg  [31:0] core_image_wdata;
    reg         core_weight_we;
    reg  [9:0]  core_weight_waddr;
    reg  [31:0] core_weight_wdata;

    // Native lenet_v2 outputs.
    wire         core_busy;
    wire         core_done;
    wire         core_overflow_error;
    wire [4:0]   core_debug_state;
    wire [63:0]  core_cycle_count;
    wire         core_image_ready;
    wire [319:0] core_logits_flat;
    wire [15:0]  core_result_frame_id;

    wire s_axis_fire;
    wire m_axis_fire;

    // Weight payload must not be accepted while lenet_v2 is busy because
    // lenet_v2 intentionally ignores weight writes while busy.
    // Image payload is accepted only while the selected Ping/Pong load bank
    // is free.
    assign s_axis_tready =
        (rx_state == RX_HEADER) ? 1'b1 :
        (rx_state == RX_WEIGHT) ? !core_busy :
        (rx_state == RX_IMAGE)  ? core_image_ready :
                                  1'b0;

    assign s_axis_fire = s_axis_tvalid && s_axis_tready;

    // -------------------------------------------------------------------------
    // Input packet parser
    // -------------------------------------------------------------------------
    always @(posedge aclk or negedge aresetn) begin
        if (!aresetn) begin
            rx_state          <= RX_HEADER;
            weight_index      <= 10'd0;
            image_index       <= 8'd0;

            core_start        <= 1'b0;
            core_image_we     <= 1'b0;
            core_image_waddr  <= 8'd0;
            core_image_wdata  <= 32'd0;
            core_weight_we    <= 1'b0;
            core_weight_waddr <= 10'd0;
            core_weight_wdata <= 32'd0;

            protocol_error    <= 1'b0;
        end else begin
            // Native write/start controls are one-cycle strobes.
            core_start     <= 1'b0;
            core_image_we  <= 1'b0;
            core_weight_we <= 1'b0;

            case (rx_state)
                RX_HEADER: begin
                    if (s_axis_fire) begin
                        if (s_axis_tkeep != 4'hF)
                            protocol_error <= 1'b1;

                        if (s_axis_tlast)
                            protocol_error <= 1'b1;

                        if (s_axis_tdata == HEADER_WEIGHT) begin
                            weight_index <= 10'd0;
                            rx_state     <= RX_WEIGHT;
                        end else if (s_axis_tdata == HEADER_IMAGE) begin
                            image_index <= 8'd0;
                            rx_state    <= RX_IMAGE;
                        end else begin
                            // Unknown packet header. Stay synchronized at the
                            // header boundary and flag the protocol error.
                            protocol_error <= 1'b1;
                            rx_state       <= RX_HEADER;
                        end
                    end
                end

                RX_WEIGHT: begin
                    if (s_axis_fire) begin
                        core_weight_we    <= 1'b1;
                        core_weight_waddr <= weight_index;
                        core_weight_wdata <= s_axis_tdata;

                        if (s_axis_tkeep != 4'hF)
                            protocol_error <= 1'b1;

                        if (weight_index == 10'd804) begin
                            if (!s_axis_tlast)
                                protocol_error <= 1'b1;

                            weight_index <= 10'd0;
                            rx_state     <= RX_HEADER;
                        end else if (s_axis_tlast) begin
                            // Early TLAST: discard the incomplete packet.
                            protocol_error <= 1'b1;
                            weight_index   <= 10'd0;
                            rx_state       <= RX_HEADER;
                        end else begin
                            weight_index <= weight_index + 10'd1;
                        end
                    end
                end

                RX_IMAGE: begin
                    if (s_axis_fire) begin
                        core_image_we    <= 1'b1;
                        core_image_waddr <= image_index;
                        core_image_wdata <= s_axis_tdata;

                        if (s_axis_tkeep != 4'hF)
                            protocol_error <= 1'b1;

                        if (image_index == 8'd195) begin
                            if (!s_axis_tlast)
                                protocol_error <= 1'b1;

                            image_index <= 8'd0;
                            rx_state    <= RX_IMG_COMMIT_1;
                        end else if (s_axis_tlast) begin
                            // Early TLAST: the partially written image is not
                            // committed because no start pulse is generated.
                            protocol_error <= 1'b1;
                            image_index    <= 8'd0;
                            rx_state       <= RX_HEADER;
                        end else begin
                            image_index <= image_index + 8'd1;
                        end
                    end
                end

                RX_IMG_COMMIT_1: begin
                    // The last image word is written into lenet_v2 on this
                    // clock edge. Assert start after that write.
                    core_start <= 1'b1;
                    rx_state   <= RX_IMG_COMMIT_2;
                end

                RX_IMG_COMMIT_2: begin
                    // lenet_v2 samples the one-cycle start pulse on this edge.
                    // Do not accept a new packet before the frame is committed.
                    rx_state <= RX_HEADER;
                end

                default: begin
                    rx_state <= RX_HEADER;
                end
            endcase
        end
    end

    // -------------------------------------------------------------------------
    // lenet_v2 core
    // -------------------------------------------------------------------------
    (* keep_hierarchy = "yes" *)
    lenet_v2 u_lenet_v2 (
        .clk             (aclk),
        .rst_n           (aresetn),

        .start           (core_start),
        .busy            (core_busy),
        .done            (core_done),
        .overflow_error  (core_overflow_error),
        .debug_state     (core_debug_state),
        .cycle_count     (core_cycle_count),

        .image_we        (core_image_we),
        .image_waddr     (core_image_waddr),
        .image_wdata     (core_image_wdata),
        .image_ready     (core_image_ready),

        .weight_we       (core_weight_we),
        .weight_waddr    (core_weight_waddr),
        .weight_wdata    (core_weight_wdata),

        .logits_flat     (core_logits_flat),
        .result_frame_id (core_result_frame_id)
    );

    // -------------------------------------------------------------------------
    // Two-entry result queue
    //
    // lenet_v2 can have two Ping/Pong frames in flight. A two-entry queue keeps
    // completed results safe if the S2MM side briefly applies backpressure.
    // -------------------------------------------------------------------------
    // Two-entry output queue is intentionally FF-based.  At depth two, using
    // registers gives unambiguous asynchronous selection by result_rd_ptr and
    // avoids inferred-RAM read-during-write behavior.
    (* ram_style = "registers" *) reg [319:0] result_logits [0:1];
    (* ram_style = "registers" *) reg [63:0]  result_cycles [0:1];
    (* ram_style = "registers" *) reg [31:0]  result_status [0:1];

    reg         result_wr_ptr;
    reg         result_rd_ptr;
    reg [1:0]   result_count;
    reg [3:0]   output_word_index;

    wire output_packet_done;
    wire result_queue_can_accept;
    wire enqueue_result;

    assign m_axis_tvalid = (result_count != 2'd0);
    assign m_axis_tkeep  = 4'hF;
    assign m_axis_tlast  = m_axis_tvalid && (output_word_index == 4'd12);
    assign m_axis_fire   = m_axis_tvalid && m_axis_tready;

    assign output_packet_done =
        m_axis_fire && (output_word_index == 4'd12);

    assign result_queue_can_accept =
        (result_count < 2'd2) || output_packet_done;

    assign enqueue_result =
        core_done && result_queue_can_accept;

    always @(posedge aclk or negedge aresetn) begin
        if (!aresetn) begin
            result_wr_ptr    <= 1'b0;
            result_rd_ptr    <= 1'b0;
            result_count     <= 2'd0;
            output_word_index<= 4'd0;
            result_overflow  <= 1'b0;
        end else begin
            // Capture a completed lenet_v2 frame.
            if (enqueue_result) begin
                result_logits[result_wr_ptr] <= core_logits_flat;
                result_cycles[result_wr_ptr] <= core_cycle_count;
                result_status[result_wr_ptr] <= {
                    8'hA5,
                    core_overflow_error,
                    protocol_error,
                    result_overflow,
                    core_debug_state,
                    core_result_frame_id
                };
                result_wr_ptr <= ~result_wr_ptr;
            end else if (core_done && !result_queue_can_accept) begin
                result_overflow <= 1'b1;
            end

            // Advance the AXI output serializer only on a valid handshake.
            if (m_axis_fire) begin
                if (output_word_index == 4'd12) begin
                    output_word_index <= 4'd0;
                    result_rd_ptr     <= ~result_rd_ptr;
                end else begin
                    output_word_index <= output_word_index + 4'd1;
                end
            end

            // Queue occupancy, including simultaneous enqueue/dequeue.
            case ({enqueue_result, output_packet_done})
                2'b10: result_count <= result_count + 2'd1;
                2'b01: result_count <= result_count - 2'd1;
                default: result_count <= result_count;
            endcase
        end
    end

    // Output data remains stable while M_AXIS_TVALID=1 and M_AXIS_TREADY=0
    // because neither result_rd_ptr nor output_word_index changes.
    always @* begin
        case (output_word_index)
            4'd0:  m_axis_tdata = result_status[result_rd_ptr];
            4'd1:  m_axis_tdata = result_logits[result_rd_ptr][31:0];
            4'd2:  m_axis_tdata = result_logits[result_rd_ptr][63:32];
            4'd3:  m_axis_tdata = result_logits[result_rd_ptr][95:64];
            4'd4:  m_axis_tdata = result_logits[result_rd_ptr][127:96];
            4'd5:  m_axis_tdata = result_logits[result_rd_ptr][159:128];
            4'd6:  m_axis_tdata = result_logits[result_rd_ptr][191:160];
            4'd7:  m_axis_tdata = result_logits[result_rd_ptr][223:192];
            4'd8:  m_axis_tdata = result_logits[result_rd_ptr][255:224];
            4'd9:  m_axis_tdata = result_logits[result_rd_ptr][287:256];
            4'd10: m_axis_tdata = result_logits[result_rd_ptr][319:288];
            4'd11: m_axis_tdata = result_cycles[result_rd_ptr][31:0];
            4'd12: m_axis_tdata = result_cycles[result_rd_ptr][63:32];
            default: m_axis_tdata = 32'd0;
        endcase
    end

endmodule

```



<h5 class="lenet-original-heading">lenet_params.vh</h5>



```verilog
`ifndef LENET_PARAMS_VH
`define LENET_PARAMS_VH

// Network dimensions
`define IN_H 28
`define IN_W 28
`define C1_OUT 4
`define C1_H 24
`define C1_W 24
`define P1_H 12
`define P1_W 12
`define C2_OUT 12
`define C2_H 8
`define C2_W 8
`define P2_H 4
`define P2_W 4
`define FC_IN 192
`define FC_OUT 10

// Packed weight byte layout. Compatible with the original baseline files.
`define CONV1_WEIGHT_BYTE_BASE 0
`define CONV1_WEIGHT_BYTES 100
`define CONV2_WEIGHT_BYTE_BASE 100
`define CONV2_WEIGHT_BYTES 1200
`define FC_WEIGHT_BYTE_BASE 1300
`define FC_WEIGHT_BYTES 1920
`define TOTAL_WEIGHT_BYTES 3220
`define TOTAL_WEIGHT_WORDS 805

// Parallelism
`define C1_OC_PAR 2
`define C2_OC_PAR 4

// Activation widths kept identical to the working v2 implementation.
`define P1_ACT_W 16
`define P2_ACT_W 24

`endif

```



- Simulation code



```verilog
`timescale 1ns/1ps

module tb_lenet_v2_1000;

    // -------------------------------------------------------------------------
    // Test configuration
    // -------------------------------------------------------------------------
    localparam integer NUM_IMAGES        = 1000;
    localparam integer WORDS_PER_IMAGE   = 196;
    localparam integer TOTAL_IMAGE_WORDS = NUM_IMAGES * WORDS_PER_IMAGE;
    localparam integer WEIGHT_WORDS      = 805;
    localparam integer NUM_CLASSES       = 10;

    // 125 MHz = 8 ns period
    localparam real CLK_PERIOD_NS = 8.0;

    // Safety timeout in modeled simulation time.
    // The complete 1000-image run normally finishes in about 35 ms.
    localparam time TIMEOUT_NS = 64'd1000000000; // 1 second

    // -------------------------------------------------------------------------
    // DUT inputs
    // -------------------------------------------------------------------------
    reg         clk;
    reg         rst_n;
    reg         start;

    reg         image_we;
    reg  [7:0]  image_waddr;
    reg  [31:0] image_wdata;

    reg         weight_we;
    reg  [9:0]  weight_waddr;
    reg  [31:0] weight_wdata;

    // -------------------------------------------------------------------------
    // DUT outputs
    // -------------------------------------------------------------------------
    wire         busy;
    wire         done;
    wire         overflow_error;
    wire [4:0]   debug_state;
    wire [63:0]  cycle_count;
    wire [319:0] logits_flat;

    // -------------------------------------------------------------------------
    // Test vectors
    // -------------------------------------------------------------------------
    reg [31:0] weight_words
        [0:WEIGHT_WORDS-1];

    reg [31:0] all_image_words
        [0:TOTAL_IMAGE_WORDS-1];

    reg [7:0] labels
        [0:NUM_IMAGES-1];

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------
    integer i;
    integer image_idx;
    integer prediction;
    integer best_value;
    integer current_value;

    integer correct_count;
    integer wrong_count;
    integer unknown_logit_count;

    reg overflow_seen_any;

    reg [63:0] total_inference_cycles;
    reg [63:0] min_inference_cycles;
    reg [63:0] max_inference_cycles;

    // Model-time timestamps. With `timescale 1ns/1ps, $time is in ns.
    time benchmark_start_time;
    time weight_load_start_time;
    time weight_load_end_time;
    time dataset_start_time;
    time dataset_end_time;

    // Calculated results
    real accuracy_percent;
    real average_cycles;
    real total_pl_time_ms;
    real average_pl_time_us;
    real min_pl_time_us;
    real max_pl_time_us;
    real weight_load_time_us;
    real dataset_modeled_time_ms;
    real total_modeled_time_ms;
    real dataset_overhead_time_ms;
    real pl_throughput_images_per_sec;

    // -------------------------------------------------------------------------
    // DUT
    // -------------------------------------------------------------------------
    lenet_v2 dut (
        .clk            (clk),
        .rst_n          (rst_n),
        .start          (start),

        .busy           (busy),
        .done           (done),
        .overflow_error (overflow_error),
        .debug_state    (debug_state),
        .cycle_count    (cycle_count),

        .image_we       (image_we),
        .image_waddr    (image_waddr),
        .image_wdata    (image_wdata),

        .weight_we      (weight_we),
        .weight_waddr   (weight_waddr),
        .weight_wdata   (weight_wdata),

        .logits_flat    (logits_flat)
    );

    // -------------------------------------------------------------------------
    // 125 MHz clock
    // -------------------------------------------------------------------------
    initial begin
        clk = 1'b0;
        forever #(CLK_PERIOD_NS / 2.0) clk = ~clk;
    end

    // -------------------------------------------------------------------------
    // Load test data
    //
    // Add the three .hex files to Vivado Simulation Sources.
    // -------------------------------------------------------------------------
    initial begin
        $readmemh("weight_words.hex",     weight_words);
        $readmemh("all_image_words.hex", all_image_words);
        $readmemh("labels.hex",           labels);
    end

    // -------------------------------------------------------------------------
    // Sticky overflow observation
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            overflow_seen_any <= 1'b0;
        else if (overflow_error)
            overflow_seen_any <= 1'b1;
    end

    // -------------------------------------------------------------------------
    // Main test
    // -------------------------------------------------------------------------
    initial begin
        // ---------------------------------------------------------------------
        // Initial values
        // ---------------------------------------------------------------------
        rst_n       = 1'b0;
        start       = 1'b0;

        image_we    = 1'b0;
        image_waddr = 8'd0;
        image_wdata = 32'd0;

        weight_we    = 1'b0;
        weight_waddr = 10'd0;
        weight_wdata = 32'd0;

        correct_count       = 0;
        wrong_count         = 0;
        unknown_logit_count = 0;

        overflow_seen_any = 1'b0;

        total_inference_cycles = 64'd0;
        min_inference_cycles   = 64'hffff_ffff_ffff_ffff;
        max_inference_cycles   = 64'd0;

        benchmark_start_time = 0;
        weight_load_start_time = 0;
        weight_load_end_time = 0;
        dataset_start_time = 0;
        dataset_end_time = 0;

        // ---------------------------------------------------------------------
        // Reset
        // ---------------------------------------------------------------------
        repeat (8) @(posedge clk);

        @(negedge clk);
        rst_n = 1'b1;

        benchmark_start_time = $time;

        // ---------------------------------------------------------------------
        // Load all 805 packed weight words into the master Weight BRAM.
        // This external BRAM upload is done once.
        // ---------------------------------------------------------------------
        weight_load_start_time = $time;

        for (i = 0; i < WEIGHT_WORDS; i = i + 1) begin
            @(negedge clk);

            weight_we    = 1'b1;
            weight_waddr = i[9:0];
            weight_wdata = weight_words[i];
        end

        @(negedge clk);
        weight_we = 1'b0;

        weight_load_end_time = $time;
        dataset_start_time   = $time;

        $display("============================================================");
        $display("LENET_V2 BMG-IP DATASET TEST START");
        $display("Images                  : %0d", NUM_IMAGES);
        $display("Clock period            : %0.3f ns", CLK_PERIOD_NS);
        $display("Clock frequency         : 125 MHz");
        $display("Weight words loaded     : %0d", WEIGHT_WORDS);
        $display("============================================================");

        // ---------------------------------------------------------------------
        // Process all images
        // ---------------------------------------------------------------------
        for (
            image_idx = 0;
            image_idx < NUM_IMAGES;
            image_idx = image_idx + 1
        ) begin

            // The accelerator must be idle before replacing Image BRAM.
            wait (busy === 1'b0);
            wait (done === 1'b0);

            // -----------------------------------------------------------------
            // Load one packed 28 x 28 image:
            // 784 bytes / 4 bytes per word = 196 words.
            // -----------------------------------------------------------------
            for (i = 0; i < WORDS_PER_IMAGE; i = i + 1) begin
                @(negedge clk);

                image_we    = 1'b1;
                image_waddr = i[7:0];
                image_wdata =
                    all_image_words[
                        image_idx * WORDS_PER_IMAGE + i
                    ];
            end

            @(negedge clk);
            image_we = 1'b0;

            // -----------------------------------------------------------------
            // One-clock start pulse
            // -----------------------------------------------------------------
            @(negedge clk);
            start = 1'b1;

            @(negedge clk);
            start = 1'b0;

            // -----------------------------------------------------------------
            // Wait for inference completion.
            //
            // Important:
            // done is generated by lenet_v2, and pl_cycle_timer sees that done
            // pulse on the following rising edge because both blocks use
            // nonblocking assignments. Therefore cycle_count is valid after
            // one additional posedge.
            // -----------------------------------------------------------------
            wait (done === 1'b1);

            @(posedge clk);
            #1;

            // cycle_count now belongs to the image that just completed.
            total_inference_cycles =
                total_inference_cycles + cycle_count;

            if (cycle_count < min_inference_cycles)
                min_inference_cycles = cycle_count;

            if (cycle_count > max_inference_cycles)
                max_inference_cycles = cycle_count;

            // -----------------------------------------------------------------
            // Argmax over ten signed int32 logits
            // -----------------------------------------------------------------
            prediction = 0;

            if (^logits_flat[31:0] === 1'bx) begin
                $display(
                    "ERROR image[%0d]: logit[0] contains X/Z",
                    image_idx
                );

                unknown_logit_count =
                    unknown_logit_count + 1;

                best_value = 32'sh8000_0000;
            end else begin
                best_value =
                    $signed(logits_flat[31:0]);
            end

            for (i = 1; i < NUM_CLASSES; i = i + 1) begin
                if (
                    ^logits_flat[i*32 +: 32] === 1'bx
                ) begin
                    $display(
                        "ERROR image[%0d]: logit[%0d] contains X/Z",
                        image_idx,
                        i
                    );

                    unknown_logit_count =
                        unknown_logit_count + 1;
                end else begin
                    current_value =
                        $signed(logits_flat[i*32 +: 32]);

                    if (current_value > best_value) begin
                        best_value = current_value;
                        prediction = i;
                    end
                end
            end

            // -----------------------------------------------------------------
            // Accuracy
            // -----------------------------------------------------------------
            if (prediction == labels[image_idx]) begin
                correct_count = correct_count + 1;
            end else begin
                wrong_count = wrong_count + 1;

                $display(
                    "MISCLASSIFIED image[%0d]: RTL=%0d LABEL=%0d cycles=%0d",
                    image_idx,
                    prediction,
                    labels[image_idx],
                    cycle_count
                );
            end

            // -----------------------------------------------------------------
            // Progress every 100 images
            // -----------------------------------------------------------------
            if (((image_idx + 1) % 100) == 0) begin
                $display(
                    "Progress %0d/%0d correct=%0d wrong=%0d acc=%0.2f%%",
                    image_idx + 1,
                    NUM_IMAGES,
                    correct_count,
                    wrong_count,
                    (100.0 * correct_count) / (image_idx + 1)
                );
            end

            // done is normally already low after the extra posedge above.
            // Keep this wait so the next transaction cannot overlap the pulse.
            wait (done === 1'b0);
        end

        dataset_end_time = $time;

        // ---------------------------------------------------------------------
        // Calculate statistics
        // ---------------------------------------------------------------------
        accuracy_percent =
            (100.0 * correct_count) / NUM_IMAGES;

        average_cycles =
            (1.0 * total_inference_cycles) / NUM_IMAGES;

        // cycle count x ns/cycle -> ns
        total_pl_time_ms =
            total_inference_cycles * CLK_PERIOD_NS / 1000000.0;

        average_pl_time_us =
            average_cycles * CLK_PERIOD_NS / 1000.0;

        min_pl_time_us =
            min_inference_cycles * CLK_PERIOD_NS / 1000.0;

        max_pl_time_us =
            max_inference_cycles * CLK_PERIOD_NS / 1000.0;

        weight_load_time_us =
            (weight_load_end_time - weight_load_start_time) / 1000.0;

        dataset_modeled_time_ms =
            (dataset_end_time - dataset_start_time) / 1000000.0;

        total_modeled_time_ms =
            (dataset_end_time - benchmark_start_time) / 1000000.0;

        dataset_overhead_time_ms =
            dataset_modeled_time_ms - total_pl_time_ms;

        if (total_pl_time_ms > 0.0)
            pl_throughput_images_per_sec =
                (NUM_IMAGES * 1000.0) / total_pl_time_ms;
        else
            pl_throughput_images_per_sec = 0.0;

        // ---------------------------------------------------------------------
        // Final report
        // ---------------------------------------------------------------------
        $display("============================================================");
        $display("LENET_V2 BMG-IP DATASET RESULT");
        $display("Correct                     : %0d/%0d",
                 correct_count, NUM_IMAGES);
        $display("Wrong                       : %0d",
                 wrong_count);
        $display("Accuracy                    : %0.2f%%",
                 accuracy_percent);
        $display("Unknown/X/Z logits          : %0d",
                 unknown_logit_count);
        $display("Overflow observed           : %0d",
                 overflow_seen_any);

        $display("------------------------------------------------------------");
        $display("Total PL cycles             : %0d",
                 total_inference_cycles);
        $display("Average cycles/image        : %0.2f",
                 average_cycles);
        $display("Minimum cycles/image        : %0d",
                 min_inference_cycles);
        $display("Maximum cycles/image        : %0d",
                 max_inference_cycles);

        $display("------------------------------------------------------------");
        $display("Pure PL total @125MHz       : %0.6f ms",
                 total_pl_time_ms);
        $display("Pure PL average/image       : %0.3f us",
                 average_pl_time_us);
        $display("Pure PL minimum/image       : %0.3f us",
                 min_pl_time_us);
        $display("Pure PL maximum/image       : %0.3f us",
                 max_pl_time_us);
        $display("Pure PL throughput          : %0.2f images/s",
                 pl_throughput_images_per_sec);

        $display("------------------------------------------------------------");
        $display("Weight BRAM loading         : %0.3f us",
                 weight_load_time_us);
        $display("Dataset modeled time        : %0.6f ms",
                 dataset_modeled_time_ms);
        $display("Dataset non-PL overhead     : %0.6f ms",
                 dataset_overhead_time_ms);
        $display("Total modeled time          : %0.6f ms",
                 total_modeled_time_ms);
        $display("============================================================");

        $finish;
    end

    // -------------------------------------------------------------------------
    // Safety timeout
    // -------------------------------------------------------------------------
    initial begin
        #(TIMEOUT_NS);

        $display(
            "FATAL timeout image=%0d state=%b busy=%b done=%b cycles=%0d",
            image_idx,
            debug_state,
            busy,
            done,
            cycle_count
        );

        $finish;
    end

endmodule

```





<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-03.png"><img src="/assets/images/lenet-project-2026/v2-03.png" alt="V2 원본 그림 3 · lenet_params.vh" width="2078" height="370" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 3 · lenet_params.vh · 클릭하면 원본 크기로 보기</figcaption></figure>



```bash
============================================================
LENET_V2 BMG-IP DATASET TEST START
Images                  : 1000
Clock period            : 8.000 ns
Clock frequency         : 125 MHz
Weight words loaded     : 805
============================================================
MISCLASSIFIED image[20]: RTL=8 LABEL=1 cycles=1504
MISCLASSIFIED image[59]: RTL=1 LABEL=2 cycles=1504
MISCLASSIFIED image[61]: RTL=9 LABEL=4 cycles=1504
MISCLASSIFIED image[94]: RTL=8 LABEL=2 cycles=1504
Progress 100/1000 correct=96 wrong=4 acc=96.00%
MISCLASSIFIED image[110]: RTL=9 LABEL=7 cycles=1504
MISCLASSIFIED image[128]: RTL=8 LABEL=1 cycles=1504
Progress 200/1000 correct=194 wrong=6 acc=97.00%
MISCLASSIFIED image[246]: RTL=5 LABEL=3 cycles=1504
MISCLASSIFIED image[273]: RTL=9 LABEL=0 cycles=1504
MISCLASSIFIED image[278]: RTL=4 LABEL=0 cycles=1504
MISCLASSIFIED image[287]: RTL=0 LABEL=6 cycles=1504
Progress 300/1000 correct=290 wrong=10 acc=96.67%
MISCLASSIFIED image[316]: RTL=2 LABEL=7 cycles=1504
Progress 400/1000 correct=389 wrong=11 acc=97.25%
Progress 500/1000 correct=489 wrong=11 acc=97.80%
MISCLASSIFIED image[508]: RTL=5 LABEL=3 cycles=1504
MISCLASSIFIED image[520]: RTL=9 LABEL=4 cycles=1504
MISCLASSIFIED image[527]: RTL=9 LABEL=4 cycles=1504
Progress 600/1000 correct=586 wrong=14 acc=97.67%
Progress 700/1000 correct=686 wrong=14 acc=98.00%
Progress 800/1000 correct=786 wrong=14 acc=98.25%
Progress 900/1000 correct=886 wrong=14 acc=98.44%
Progress 1000/1000 correct=986 wrong=14 acc=98.60%
============================================================
LENET_V2 BMG-IP DATASET RESULT
Correct                     : 986/1000
Wrong                       : 14
Accuracy                    : 98.60%
Unknown/X/Z logits          : 0
Overflow observed           : 0
------------------------------------------------------------
Total PL cycles             : 1510442
Average cycles/image        : 1510.44
Minimum cycles/image        : 1504
Maximum cycles/image        : 7946
------------------------------------------------------------
Pure PL total @125MHz       : 12.083536 ms
Pure PL average/image       : 12.084 us
Pure PL minimum/image       : 12.032 us
Pure PL maximum/image       : 63.568 us
Pure PL throughput          : 82757.23 images/s
------------------------------------------------------------
Weight BRAM loading         : 6.448 us
Dataset modeled time        : 13.683541 ms
Dataset non-PL overhead     : 1.600005 ms
Total modeled time          : 13.689989 ms
============================================================
```





```bash
============================================================
 LENET AXI WRAPPER DATASET SIMULATION
 Clock        : 125 MHz
 Images       : 1000
 Weight words : 805
============================================================
Sending weight packet...
Weight packet complete.
MISCLASSIFIED image[20]: AXIS=8 LABEL=1 cycles=1504
  logits: 9780711 11545767 9437760 0 4010856 0 9950556 0 17199342 0
MISCLASSIFIED image[59]: AXIS=1 LABEL=2 cycles=1504
  logits: 0 28227836 25024248 5319674 0 0 764578 0 21092369 0
MISCLASSIFIED image[61]: AXIS=9 LABEL=4 cycles=1504
  logits: 0 4055719 3850217 118952 21014173 0 0 6845841 4193318 21375826
MISCLASSIFIED image[94]: AXIS=8 LABEL=2 cycles=1504
  logits: 0 18584919 22537120 605850 0 2747534 0 0 29510764 5696451
Progress 100/1000 correct=96 wrong=4
MISCLASSIFIED image[110]: AXIS=9 LABEL=7 cycles=1504
  logits: 0 11933352 8593986 193046 0 0 0 18369555 6645029 22399519
MISCLASSIFIED image[128]: AXIS=8 LABEL=1 cycles=1504
  logits: 0 12106443 7702000 7257941 0 6581200 10859137 0 19017769 0
Progress 200/1000 correct=194 wrong=6
MISCLASSIFIED image[246]: AXIS=5 LABEL=3 cycles=1504
  logits: 998177 0 651997 34147954 0 40750429 0 4998677 13649668 10781099
MISCLASSIFIED image[273]: AXIS=9 LABEL=0 cycles=1504
  logits: 26988731 0 10928520 0 0 0 0 4711667 19511658 33636187
MISCLASSIFIED image[278]: AXIS=4 LABEL=0 cycles=1504
  logits: 12919759 0 1525014 0 13133380 663104 10114426 0 10636819 6586348
MISCLASSIFIED image[287]: AXIS=0 LABEL=6 cycles=1504
  logits: 19933705 0 13277917 4396604 6072181 1267200 13916804 0 8264651 0
Progress 300/1000 correct=290 wrong=10
MISCLASSIFIED image[316]: AXIS=2 LABEL=7 cycles=1504
  logits: 8919249 0 34695982 19546819 0 0 0 33686993 31595567 18464547
Progress 400/1000 correct=389 wrong=11
Progress 500/1000 correct=489 wrong=11
MISCLASSIFIED image[508]: AXIS=5 LABEL=3 cycles=1504
  logits: 9434400 11681118 19607773 22333924 0 22395236 0 517716 0 2782209
MISCLASSIFIED image[520]: AXIS=9 LABEL=4 cycles=1504
  logits: 0 21457211 0 0 29922282 0 0 11291617 28372228 37671399
MISCLASSIFIED image[527]: AXIS=9 LABEL=4 cycles=1504
  logits: 747080 5838908 8393276 0 17302415 8432803 0 11283259 6941694 18286512
Progress 600/1000 correct=586 wrong=14
Progress 700/1000 correct=686 wrong=14
Progress 800/1000 correct=786 wrong=14
Progress 900/1000 correct=886 wrong=14
Progress 1000/1000 correct=986 wrong=14

============================================================
 AXI WRAPPER SIMULATION RESULT
============================================================
Correct             : 986 / 1000
Wrong               : 14
Accuracy            : 98.60 %
Frame ID errors     : 0
Protocol errors     : 0
Core overflow count : 0
Protocol sticky     : 0
Queue sticky        : 0
Total cycles        : 1510442
Average cycles      : 1510.44
Min cycles          : 1504
Max cycles          : 7946
============================================================
```



<h3 class="lenet-original-heading">Block Design</h3>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-04.png"><img src="/assets/images/lenet-project-2026/v2-04.png" alt="V2 원본 그림 4 · Block Design" width="1858" height="722" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 4 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-05.png"><img src="/assets/images/lenet-project-2026/v2-05.png" alt="V2 원본 그림 5 · Block Design" width="2286" height="489" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 5 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-06.png"><img src="/assets/images/lenet-project-2026/v2-06.png" alt="V2 원본 그림 6 · Block Design" width="915" height="230" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 6 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-07.png"><img src="/assets/images/lenet-project-2026/v2-07.png" alt="V2 원본 그림 7 · Block Design" width="658" height="605" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 7 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v2-08.png"><img src="/assets/images/lenet-project-2026/v2-08.png" alt="V2 원본 그림 8 · Block Design" width="703" height="436" loading="lazy" decoding="async"></a><figcaption>V2 원본 그림 8 · Block Design · 클릭하면 원본 크기로 보기</figcaption></figure>

<h3 class="lenet-original-heading">PS 영역</h3>

<h4 class="lenet-original-heading">C 코드</h4>



```c
/******************************************************************************
 * LeNet-v2 AXI-DMA timing / accuracy analysis
 *
 * Vitis 2024.1 / Zynq-7000 Cortex-A9
 *
 * IMPORTANT
 * ---------
 * - NO PS-side CNN inference.
 * - NO xtime_l.h.
 * - NO xiltimer.h.
 * - End-to-end PS+PL timing uses the Cortex-A9 Global Timer directly.
 *
 * Timing definitions
 * ------------------
 * PL time:
 *   FPGA internal cycle_count only.
 *
 * PS+PL FULL time:
 *   Entire accelerator workload measured on PS:
 *
 *     weight packet build
 *     + weight DMA
 *     + 1000 image packet builds
 *     + DMA setup / MM2S / S2MM
 *     + PL inference
 *     + result decode
 *
 *   UART printing is intentionally outside the timed region.
 *   Per-image detailed logits are not printed; only misclassifications and
 *   the final performance summary are printed.
 *
 * Production result packet:
 *   word 0      : status
 *   word 1..10  : logits 0..9
 *   word 11     : cycle_count[31:0]
 *   word 12     : cycle_count[63:32], TLAST
 ******************************************************************************/

#include <stdio.h>
#include <stdint.h>
#include <string.h>

#include "platform.h"
#include "xparameters.h"
#include "xstatus.h"
#include "xil_types.h"
#include "xil_cache.h"
#include "xil_io.h"

#include "xaxidma.h"
#include "xaxidma_hw.h"

#include "cnn_common.h"

/* ------------------------------------------------------------------------- */
/* Configuration                                                             */
/* ------------------------------------------------------------------------- */

#define N_TEST                      1000U

#define PL_CLK_HZ                   125000000ULL

#define IMAGE_BYTES                 784U
#define IMAGE_WORDS                 196U

#define WEIGHT_WORDS                805U

#define NUM_LOGITS                  10U

#define HEADER_WEIGHT               0x57475431U
#define HEADER_IMAGE                0x494D4731U

#define WEIGHT_PACKET_WORDS         806U
#define WEIGHT_PACKET_BYTES         (WEIGHT_PACKET_WORDS * 4U)

#define IMAGE_PACKET_WORDS          197U
#define IMAGE_PACKET_BYTES          (IMAGE_PACKET_WORDS * 4U)

#define RESULT_WORDS                13U
#define RESULT_BYTES                (RESULT_WORDS * 4U)

#define DMA_POLL_LIMIT              20000000U

#define EXPECTED_WEIGHT_HASH        0xE456BE42U

/* ------------------------------------------------------------------------- */
/* DMA base                                                                  */
/* ------------------------------------------------------------------------- */

#if defined(XPAR_XAXIDMA_0_BASEADDR)
#define DMA_BASEADDR XPAR_XAXIDMA_0_BASEADDR
#elif defined(XPAR_AXI_DMA_0_BASEADDR)
#define DMA_BASEADDR XPAR_AXI_DMA_0_BASEADDR
#elif defined(XPAR_AXIDMA_0_BASEADDR)
#define DMA_BASEADDR XPAR_AXIDMA_0_BASEADDR
#else
#define DMA_BASEADDR 0x40400000U
#endif

/* ------------------------------------------------------------------------- */
/* Cortex-A9 Global Timer frequency                                          */
/* ------------------------------------------------------------------------- */

/*
 * Zynq-7000 Cortex-A9 Global Timer runs at half the CPU clock.
 *
 * Current Zynq-7000 PS configuration uses approximately 666.666666 MHz CPU,
 * therefore the global timer is approximately 333.333333 MHz.
 *
 * This fixed constant intentionally avoids Vitis/xparameters macro-name
 * differences that caused the previous build error.
 *
 * If the PS CPU clock is later changed from ~666.666 MHz, update this value.
 */
#define GLOBAL_TIMER_HZ             333333333ULL

/* ------------------------------------------------------------------------- */
/* Cortex-A9 Global Timer registers                                          */
/* ------------------------------------------------------------------------- */

/*
 * Zynq-7000 MPCore private peripheral region:
 *
 * 0xF8F00200 : Global Timer Counter Low
 * 0xF8F00204 : Global Timer Counter High
 * 0xF8F00208 : Global Timer Control
 */
#define GTIMER_COUNTER_LOW_ADDR      0xF8F00200U
#define GTIMER_COUNTER_HIGH_ADDR     0xF8F00204U
#define GTIMER_CONTROL_ADDR          0xF8F00208U

#define GTIMER_ENABLE_MASK           0x00000001U

/* ------------------------------------------------------------------------- */
/* Result status                                                             */
/* ------------------------------------------------------------------------- */

#define RESULT_MAGIC_MASK            0xFF000000U
#define RESULT_MAGIC_VALUE           0xA5000000U

#define RESULT_CORE_OVERFLOW         (1U << 23)
#define RESULT_PROTOCOL_ERROR        (1U << 22)
#define RESULT_QUEUE_OVERFLOW        (1U << 21)

#define RESULT_FRAME_ID_MASK         0x0000FFFFU

/* ------------------------------------------------------------------------- */
/* DMA / buffers                                                             */
/* ------------------------------------------------------------------------- */

static XAxiDma AxiDma;

static u32 weight_tx_buffer[WEIGHT_PACKET_WORDS]
    __attribute__((aligned(64)));

static u32 image_tx_buffer[IMAGE_PACKET_WORDS]
    __attribute__((aligned(64)));

static u32 result_rx_buffer[RESULT_WORDS]
    __attribute__((aligned(64)));

/* ------------------------------------------------------------------------- */
/* Result structure                                                          */
/* ------------------------------------------------------------------------- */

typedef struct
{
    u32 status;
    int32_t logits[NUM_LOGITS];
    u64 cycles;
    u16 frame_id;
    u8 prediction;
} inference_result_t;

static u32 mismatch_index[N_TEST];
static u8 mismatch_label[N_TEST];
static u8 mismatch_prediction[N_TEST];
static u32 mismatch_count = 0U;

/* ------------------------------------------------------------------------- */
/* Cortex-A9 Global Timer                                                    */
/* ------------------------------------------------------------------------- */

static void global_timer_init(void)
{
    u32 control = Xil_In32(GTIMER_CONTROL_ADDR);

    if ((control & GTIMER_ENABLE_MASK) == 0U) {
        Xil_Out32(
            GTIMER_CONTROL_ADDR,
            control | GTIMER_ENABLE_MASK
        );
    }
}

/*
 * Stable 64-bit read:
 * high -> low -> high, repeat if rollover occurred.
 */
static u64 global_timer_read(void)
{
    u32 high1;
    u32 low;
    u32 high2;

    do {
        high1 = Xil_In32(GTIMER_COUNTER_HIGH_ADDR);
        low   = Xil_In32(GTIMER_COUNTER_LOW_ADDR);
        high2 = Xil_In32(GTIMER_COUNTER_HIGH_ADDR);
    } while (high1 != high2);

    return ((u64)high2 << 32) | (u64)low;
}

/* ------------------------------------------------------------------------- */
/* Time conversion                                                           */
/* ------------------------------------------------------------------------- */

static u64 global_ticks_to_ns(u64 ticks)
{
    return (ticks * 1000000000ULL) / GLOBAL_TIMER_HZ;
}

static u64 pl_cycles_to_ns(u64 cycles)
{
    return (cycles * 1000000000ULL) / PL_CLK_HZ;
}

static void print_ns_as_us(const char *name, u64 ns)
{
    printf(
        "%-32s : %llu.%03llu us\r\n",
        name,
        (unsigned long long)(ns / 1000ULL),
        (unsigned long long)(ns % 1000ULL)
    );
}

static void print_ns_as_ms(const char *name, u64 ns)
{
    printf(
        "%-32s : %llu.%06llu ms\r\n",
        name,
        (unsigned long long)(ns / 1000000ULL),
        (unsigned long long)(ns % 1000000ULL)
    );
}

/* ------------------------------------------------------------------------- */
/* Packing                                                                   */
/* ------------------------------------------------------------------------- */

static inline u32 pack_u8x4(const uint8_t *p)
{
    return ((u32)p[0]) |
           ((u32)p[1] << 8) |
           ((u32)p[2] << 16) |
           ((u32)p[3] << 24);
}

static inline u32 pack_i8x4(const int8_t *p)
{
    return ((u32)(uint8_t)p[0]) |
           ((u32)(uint8_t)p[1] << 8) |
           ((u32)(uint8_t)p[2] << 16) |
           ((u32)(uint8_t)p[3] << 24);
}

/* ------------------------------------------------------------------------- */
/* FNV hash                                                                  */
/* ------------------------------------------------------------------------- */

static u32 hash_words(const u32 *words, u32 count)
{
    u32 hash = 0x811C9DC5U;
    u32 i;

    for (i = 0U; i < count; ++i) {
        hash ^= words[i];
        hash *= 0x01000193U;
    }

    return hash;
}

/* ------------------------------------------------------------------------- */
/* DMA helpers                                                               */
/* ------------------------------------------------------------------------- */

static u32 dma_get_status(int direction)
{
    u32 offset;

    if (direction == XAXIDMA_DMA_TO_DEVICE) {
        offset =
            XAXIDMA_TX_OFFSET +
            XAXIDMA_SR_OFFSET;
    } else {
        offset =
            XAXIDMA_RX_OFFSET +
            XAXIDMA_SR_OFFSET;
    }

    return XAxiDma_ReadReg(
        (UINTPTR)DMA_BASEADDR,
        offset
    );
}

static void dma_dump_status(void)
{
    printf(
        "MM2S_DMASR = 0x%08lx\r\n",
        (unsigned long)
        dma_get_status(XAXIDMA_DMA_TO_DEVICE)
    );

    printf(
        "S2MM_DMASR = 0x%08lx\r\n",
        (unsigned long)
        dma_get_status(XAXIDMA_DEVICE_TO_DMA)
    );
}

static int dma_wait_reset(void)
{
    u32 i;

    for (i = 0U; i < DMA_POLL_LIMIT; ++i) {
        if (XAxiDma_ResetIsDone(&AxiDma))
            return XST_SUCCESS;
    }

    return XST_FAILURE;
}

static int dma_wait_channel(int direction)
{
    u32 i;

    for (i = 0U; i < DMA_POLL_LIMIT; ++i) {
        const u32 status =
            dma_get_status(direction);

        if ((status & XAXIDMA_ERR_ALL_MASK) != 0U)
            return XST_FAILURE;

        if (!XAxiDma_Busy(&AxiDma, direction))
            return XST_SUCCESS;
    }

    return XST_FAILURE;
}

static int dma_init(void)
{
    XAxiDma_Config *cfg;
    int rc;

    cfg =
        XAxiDma_LookupConfig(
            (UINTPTR)DMA_BASEADDR
        );

    if (cfg == NULL)
        return XST_FAILURE;

    rc =
        XAxiDma_CfgInitialize(
            &AxiDma,
            cfg
        );

    if (rc != XST_SUCCESS)
        return XST_FAILURE;

    if (XAxiDma_HasSg(&AxiDma))
        return XST_FAILURE;

    XAxiDma_IntrDisable(
        &AxiDma,
        XAXIDMA_IRQ_ALL_MASK,
        XAXIDMA_DMA_TO_DEVICE
    );

    XAxiDma_IntrDisable(
        &AxiDma,
        XAXIDMA_IRQ_ALL_MASK,
        XAXIDMA_DEVICE_TO_DMA
    );

    XAxiDma_Reset(&AxiDma);

    return dma_wait_reset();
}

/* ------------------------------------------------------------------------- */
/* Weight packet                                                             */
/* ------------------------------------------------------------------------- */

static u32 append_weight_array(
    u32 index,
    const int8_t *src,
    u32 byte_count)
{
    u32 i;

    for (i = 0U; i < byte_count; i += 4U) {
        weight_tx_buffer[index++] =
            pack_i8x4(&src[i]);
    }

    return index;
}

static int build_weight_packet(void)
{
    u32 index = 0U;

    const u32 conv1_bytes =
        (u32)sizeof(conv1_w_embedded);

    const u32 conv2_bytes =
        (u32)sizeof(conv2_w_embedded);

    const u32 fc_bytes =
        (u32)sizeof(fc1_w_embedded);

    const u32 total_bytes =
        conv1_bytes +
        conv2_bytes +
        fc_bytes;

    if (total_bytes != WEIGHT_WORDS * 4U)
        return XST_FAILURE;

    weight_tx_buffer[index++] =
        HEADER_WEIGHT;

    index =
        append_weight_array(
            index,
            conv1_w_embedded,
            conv1_bytes
        );

    index =
        append_weight_array(
            index,
            conv2_w_embedded,
            conv2_bytes
        );

    index =
        append_weight_array(
            index,
            fc1_w_embedded,
            fc_bytes
        );

    if (index != WEIGHT_PACKET_WORDS)
        return XST_FAILURE;

    return XST_SUCCESS;
}

static int verify_weight_packet(void)
{
    const u32 hash =
        hash_words(
            &weight_tx_buffer[1],
            WEIGHT_WORDS
        );

    return
        (hash == EXPECTED_WEIGHT_HASH)
        ? XST_SUCCESS
        : XST_FAILURE;
}

static int transfer_weights(void)
{
    int rc;

    /*
     * MM2S reads the TX buffer from DDR, so push the cache-resident
     * packet to DDR before starting DMA.
     */
    Xil_DCacheFlushRange(
        (UINTPTR)weight_tx_buffer,
        WEIGHT_PACKET_BYTES
    );

    rc =
        XAxiDma_SimpleTransfer(
            &AxiDma,
            (UINTPTR)weight_tx_buffer,
            WEIGHT_PACKET_BYTES,
            XAXIDMA_DMA_TO_DEVICE
        );

    if (rc != XST_SUCCESS)
        return XST_FAILURE;

    return
        dma_wait_channel(
            XAXIDMA_DMA_TO_DEVICE
        );
}

/* ------------------------------------------------------------------------- */
/* Image packet                                                              */
/* ------------------------------------------------------------------------- */

static void build_image_packet(const uint8_t *image)
{
    /*
     * Zynq-7000 Cortex-A9 is little-endian in this application.
     * The previous explicit pack_u8x4() produced the exact same 784-byte
     * memory layout, so a bulk memcpy is both simpler and much cheaper on PS.
     */
    image_tx_buffer[0] =
        HEADER_IMAGE;

    memcpy(
        (void *)&image_tx_buffer[1],
        (const void *)image,
        IMAGE_BYTES
    );
}

/* ------------------------------------------------------------------------- */
/* Output result                                                             */
/* ------------------------------------------------------------------------- */

static u8 argmax_logits(
    const int32_t logits[NUM_LOGITS])
{
    u32 i;

    u8 best_index = 0U;

    int32_t best_value =
        logits[0];

    for (i = 1U; i < NUM_LOGITS; ++i) {
        if (logits[i] > best_value) {
            best_value =
                logits[i];

            best_index =
                (u8)i;
        }
    }

    return best_index;
}

static int decode_result(
    inference_result_t *result)
{
    u32 i;

    result->status =
        result_rx_buffer[0];

    if ((result->status & RESULT_MAGIC_MASK)
        != RESULT_MAGIC_VALUE) {
        return XST_FAILURE;
    }

    for (i = 0U; i < NUM_LOGITS; ++i) {
        result->logits[i] =
            (int32_t)
            result_rx_buffer[i + 1U];
    }

    result->cycles =
        ((u64)result_rx_buffer[12] << 32) |
        (u64)result_rx_buffer[11];

    result->frame_id =
        (u16)(
            result->status &
            RESULT_FRAME_ID_MASK
        );

    result->prediction =
        argmax_logits(
            result->logits
        );

    return XST_SUCCESS;
}

/* ------------------------------------------------------------------------- */
/* One complete image transaction                                            */
/* ------------------------------------------------------------------------- */

static int pl_infer_one(
    const uint8_t *image,
    inference_result_t *result)
{
    int rc;

    /*
     * PS preparation.
     */
    build_image_packet(image);

    /*
     * MM2S source:
     * DMA is not coherent with the Cortex-A9 data cache through HP0.
     * Flush the image packet so DDR contains the latest bytes.
     */
    Xil_DCacheFlushRange(
        (UINTPTR)image_tx_buffer,
        IMAGE_PACKET_BYTES
    );

    /*
     * S2MM destination:
     * discard any cached copy left from the previous result before DMA writes.
     *
     * The result buffer is 64-byte aligned and dedicated to DMA, so this
     * cache maintenance cannot discard unrelated application data.
     */
    Xil_DCacheInvalidateRange(
        (UINTPTR)result_rx_buffer,
        RESULT_BYTES
    );

    /*
     * Start S2MM first so the accelerator always has an output sink.
     */
    rc =
        XAxiDma_SimpleTransfer(
            &AxiDma,
            (UINTPTR)result_rx_buffer,
            RESULT_BYTES,
            XAXIDMA_DEVICE_TO_DMA
        );

    if (rc != XST_SUCCESS)
        return XST_FAILURE;

    /*
     * Send IMG1 + image payload.
     */
    rc =
        XAxiDma_SimpleTransfer(
            &AxiDma,
            (UINTPTR)image_tx_buffer,
            IMAGE_PACKET_BYTES,
            XAXIDMA_DMA_TO_DEVICE
        );

    if (rc != XST_SUCCESS)
        return XST_FAILURE;

    if (dma_wait_channel(
            XAXIDMA_DMA_TO_DEVICE)
        != XST_SUCCESS) {
        return XST_FAILURE;
    }

    if (dma_wait_channel(
            XAXIDMA_DEVICE_TO_DMA)
        != XST_SUCCESS) {
        return XST_FAILURE;
    }

    /*
     * DMA has written the result to DDR. Invalidate before the CPU reads
     * status/logits/cycle_count so stale cache lines cannot be used.
     */
    Xil_DCacheInvalidateRange(
        (UINTPTR)result_rx_buffer,
        RESULT_BYTES
    );

    return
        decode_result(result);
}

/* ------------------------------------------------------------------------- */
/* Main                                                                      */
/* ------------------------------------------------------------------------- */

int main(void)
{
    u32 i;

    u32 pl_correct = 0U;

    u32 frame_errors = 0U;
    u32 protocol_errors = 0U;
    u32 core_overflows = 0U;
    u32 queue_overflows = 0U;

    u64 total_pl_cycles = 0ULL;
    u64 steady_pl_cycles = 0ULL;

    u64 min_pl_cycles = ~0ULL;
    u64 max_pl_cycles = 0ULL;

    u64 full_start_ticks;
    u64 full_end_ticks;
    u64 full_ticks;

    init_platform();

    /*
     * Performance build:
     * keep the Cortex-A9 data cache enabled.
     *
     * AXI DMA reaches DDR through the non-coherent HP path, therefore every
     * DMA buffer is maintained explicitly:
     *
     *   TX : build -> FlushRange -> DMA
     *   RX : InvalidateRange -> DMA -> InvalidateRange -> CPU read
     */
    Xil_DCacheFlush();
    Xil_DCacheEnable();

    global_timer_init();

    printf("\r\n");
    printf("============================================================\r\n");
    printf(" LeNet-v2 D-CACHE ON / PS+PL TIMING ANALYSIS\r\n");
    printf("============================================================\r\n");
    printf("D-cache         = ENABLED with explicit DMA cache maintenance\r\n");

    printf(
        "DMA address     = 0x%08lx\r\n",
        (unsigned long)DMA_BASEADDR
    );

    printf(
        "Result packet   = %u words / %u bytes\r\n",
        (unsigned int)RESULT_WORDS,
        (unsigned int)RESULT_BYTES
    );

    printf(
        "Images          = %u\r\n",
        (unsigned int)N_TEST
    );

    printf(
        "PL clock        = %llu Hz\r\n",
        (unsigned long long)PL_CLK_HZ
    );

    printf(
        "Global timer    = %llu Hz (fixed for ~666.666 MHz Cortex-A9)\r\n",
        (unsigned long long)GLOBAL_TIMER_HZ
    );

    printf("\r\n");
    printf(
        "PL time         = FPGA computation cycle_count only\r\n"
    );

    printf(
        "PS+PL FULL time = weight setup/DMA + 1000 complete inferences\r\n"
    );

    printf(
        "UART output     = excluded from measured region\r\n"
    );

    printf("============================================================\r\n");

    if (dma_init() != XST_SUCCESS) {
        printf(
            "ERROR: DMA initialization failed\r\n"
        );

        goto fail;
    }

    /*
     * ---------------------------------------------------------------------
     * FULL PS+PL TIMER START
     *
     * Includes:
     *   weight packet build
     *   weight hash verification
     *   weight DMA
     *   all image packing
     *   all DMA setup/transfers
     *   all PL inference
     *   all result decode
     *
     * Excludes:
     *   platform init
     *   DMA init
     *   UART result printing
     * ---------------------------------------------------------------------
     */
    full_start_ticks =
        global_timer_read();

    if (build_weight_packet()
        != XST_SUCCESS) {
        goto timed_fail;
    }

    if (verify_weight_packet()
        != XST_SUCCESS) {
        goto timed_fail;
    }

    if (transfer_weights()
        != XST_SUCCESS) {
        goto timed_fail;
    }

    for (i = 0U; i < N_TEST; ++i) {

        const uint8_t *image =
            &test_1000_images_embedded[
                i * IMAGE_BYTES
            ];

        const u8 label =
            test_1000_labels_embedded[i];

        inference_result_t result;

        memset(
            &result,
            0,
            sizeof(result)
        );

        if (pl_infer_one(
                image,
                &result)
            != XST_SUCCESS) {
            goto timed_fail;
        }

        if (result.prediction == label) {
            ++pl_correct;
        }
        else {
            mismatch_index[mismatch_count] =
                i;

            mismatch_label[mismatch_count] =
                label;

            mismatch_prediction[mismatch_count] =
                result.prediction;

            ++mismatch_count;
        }

        if (result.frame_id != (u16)i)
            ++frame_errors;

        if ((result.status &
             RESULT_PROTOCOL_ERROR) != 0U) {
            ++protocol_errors;
        }

        if ((result.status &
             RESULT_CORE_OVERFLOW) != 0U) {
            ++core_overflows;
        }

        if ((result.status &
             RESULT_QUEUE_OVERFLOW) != 0U) {
            ++queue_overflows;
        }

        total_pl_cycles +=
            result.cycles;

        /*
         * First frame includes one-time weight-cache preload.
         * Images 1..999 are steady-state.
         */
        if (i != 0U) {
            steady_pl_cycles +=
                result.cycles;
        }

        if (result.cycles <
            min_pl_cycles) {
            min_pl_cycles =
                result.cycles;
        }

        if (result.cycles >
            max_pl_cycles) {
            max_pl_cycles =
                result.cycles;
        }

    }

    full_end_ticks =
        global_timer_read();

    /*
     * ---------------------------------------------------------------------
     * FULL PS+PL TIMER END
     * ---------------------------------------------------------------------
     */

    full_ticks =
        full_end_ticks -
        full_start_ticks;

    /*
     * Timing is complete.
     * UART output begins only now.
     */

    printf("\r\n");
    printf("============================================================\r\n");
    printf(" MISCLASSIFICATIONS\r\n");
    printf("============================================================\r\n");

    if (mismatch_count == 0U) {
        printf("None\r\n");
    }
    else {
        for (i = 0U;
             i < mismatch_count;
             ++i) {

            printf(
                "image[%lu]: label=%u PL=%u\r\n",
                (unsigned long)
                mismatch_index[i],

                (unsigned int)
                mismatch_label[i],

                (unsigned int)
                mismatch_prediction[i]
            );
        }
    }

    {
        const u64 total_pl_ns =
            pl_cycles_to_ns(
                total_pl_cycles
            );

        const u64 avg_pl_ns =
            total_pl_ns /
            N_TEST;

        const u64 steady_pl_ns =
            pl_cycles_to_ns(
                steady_pl_cycles
            );

        const u64 steady_avg_pl_ns =
            steady_pl_ns /
            (N_TEST - 1U);

        const u64 min_pl_ns =
            pl_cycles_to_ns(
                min_pl_cycles
            );

        const u64 max_pl_ns =
            pl_cycles_to_ns(
                max_pl_cycles
            );

        const u64 full_ps_pl_ns =
            global_ticks_to_ns(
                full_ticks
            );

        const u64 avg_full_ps_pl_ns =
            full_ps_pl_ns /
            N_TEST;

        const u64 non_pl_ns =
            (full_ps_pl_ns >= total_pl_ns)
            ? (full_ps_pl_ns - total_pl_ns)
            : 0ULL;

        const u64 avg_non_pl_ns =
            non_pl_ns /
            N_TEST;

        /*
         * milli-images/s:
         *
         * images/s * 1000
         * = N * 1e12 / ns
         */
        const u64 throughput_x1000 =
            (full_ps_pl_ns == 0ULL)
            ? 0ULL
            : ((u64)N_TEST *
               1000000000000ULL) /
              full_ps_pl_ns;

        /*
         * Percent values are stored in hundredths of a percent.
         * Example: 442 => 4.42 %
         */
        const u64 pl_share_x100 =
            (full_ps_pl_ns == 0ULL)
            ? 0ULL
            : (total_pl_ns * 10000ULL) /
              full_ps_pl_ns;

        const u64 non_pl_share_x100 =
            (full_ps_pl_ns == 0ULL)
            ? 0ULL
            : (non_pl_ns * 10000ULL) /
              full_ps_pl_ns;

        /*
         * End-to-end / PL ratio in thousandths.
         * Example: 22622 => 22.622 x
         */
        const u64 e2e_to_pl_x1000 =
            (total_pl_ns == 0ULL)
            ? 0ULL
            : (full_ps_pl_ns * 1000ULL) /
              total_pl_ns;

        /*
         * Pure steady-state PL throughput, in milli-images/s.
         */
        const u64 pure_pl_throughput_x1000 =
            (steady_avg_pl_ns == 0ULL)
            ? 0ULL
            : 1000000000000ULL /
              steady_avg_pl_ns;

        printf("\r\n");
        printf("============================================================\r\n");
        printf(" FINAL SUMMARY\r\n");
        printf("============================================================\r\n");

        printf(
            "Processed                       : %u / %u\r\n",
            (unsigned int)N_TEST,
            (unsigned int)N_TEST
        );

        printf(
            "PL accuracy                     : %lu / %u = %lu.%02lu %%\r\n",

            (unsigned long)
            pl_correct,

            (unsigned int)
            N_TEST,

            (unsigned long)
            (((u64)pl_correct *
              100ULL) /
             N_TEST),

            (unsigned long)
            ((((u64)pl_correct *
               10000ULL) /
              N_TEST) %
             100ULL)
        );

        printf(
            "Misclassifications              : %lu\r\n",
            (unsigned long)
            mismatch_count
        );

        printf(
            "Frame ID errors                 : %lu\r\n",
            (unsigned long)
            frame_errors
        );

        printf(
            "Protocol errors                 : %lu\r\n",
            (unsigned long)
            protocol_errors
        );

        printf(
            "Core overflows                  : %lu\r\n",
            (unsigned long)
            core_overflows
        );

        printf(
            "Queue overflows                 : %lu\r\n",
            (unsigned long)
            queue_overflows
        );

        printf("\r\n");
        printf("---------------- PL TIME -----------------------------\r\n");

        printf(
            "Total PL cycles                 : %llu\r\n",
            (unsigned long long)
            total_pl_cycles
        );

        printf(
            "Average PL cycles               : %llu\r\n",
            (unsigned long long)
            (total_pl_cycles /
             N_TEST)
        );

        printf(
            "Min PL cycles                   : %llu\r\n",
            (unsigned long long)
            min_pl_cycles
        );

        printf(
            "Max PL cycles                   : %llu\r\n",
            (unsigned long long)
            max_pl_cycles
        );

        print_ns_as_ms(
            "Total PL computation time",
            total_pl_ns
        );

        print_ns_as_us(
            "Average PL computation time",
            avg_pl_ns
        );

        print_ns_as_us(
            "Steady-state PL avg (1..999)",
            steady_avg_pl_ns
        );

        print_ns_as_us(
            "Min PL computation time",
            min_pl_ns
        );

        print_ns_as_us(
            "Max PL computation time",
            max_pl_ns
        );

        printf("\r\n");
        printf("---------------- PS+PL FULL TIME ---------------------\r\n");

        print_ns_as_ms(
            "PS+PL FULL total time",
            full_ps_pl_ns
        );

        print_ns_as_us(
            "PS+PL FULL avg / image",
            avg_full_ps_pl_ns
        );

        printf("\r\n");
        printf("---------------- OVERHEAD ----------------------------\r\n");

        print_ns_as_ms(
            "Total non-PL time",
            non_pl_ns
        );

        print_ns_as_us(
            "Average non-PL / image",
            avg_non_pl_ns
        );

        printf(
            "Full throughput                 : %llu.%03llu images/s\r\n",

            (unsigned long long)
            (throughput_x1000 /
             1000ULL),

            (unsigned long long)
            (throughput_x1000 %
             1000ULL)
        );

        printf(
            "Pure PL steady throughput       : %llu.%03llu images/s\r\n",

            (unsigned long long)
            (pure_pl_throughput_x1000 /
             1000ULL),

            (unsigned long long)
            (pure_pl_throughput_x1000 %
             1000ULL)
        );

        printf(
            "PL share of full time           : %llu.%02llu %%\r\n",

            (unsigned long long)
            (pl_share_x100 /
             100ULL),

            (unsigned long long)
            (pl_share_x100 %
             100ULL)
        );

        printf(
            "Non-PL share of full time       : %llu.%02llu %%\r\n",

            (unsigned long long)
            (non_pl_share_x100 /
             100ULL),

            (unsigned long long)
            (non_pl_share_x100 %
             100ULL)
        );

        printf(
            "End-to-end / PL time ratio      : %llu.%03llu x\r\n",

            (unsigned long long)
            (e2e_to_pl_x1000 /
             1000ULL),

            (unsigned long long)
            (e2e_to_pl_x1000 %
             1000ULL)
        );

        printf("============================================================\r\n");
        printf("TEST FINISHED\r\n");
    }

    cleanup_platform();

    while (1) {
    }

    return XST_SUCCESS;

timed_fail:

    full_end_ticks =
        global_timer_read();

    printf("\r\n");
    printf("ERROR: workload failed during timed region\r\n");

fail:

    printf("============================================================\r\n");
    printf("TEST FAILED\r\n");
    printf("============================================================\r\n");

    dma_dump_status();

    cleanup_platform();

    while (1) {
    }

    return XST_FAILURE;
}
```





```bash
============================================================
 LeNet-v2 D-CACHE ON / PS+PL TIMING ANALYSIS
============================================================
D-cache         = ENABLED with explicit DMA cache maintenance
DMA address     = 0x40400000
Result packet   = 13 words / 52 bytes
Images          = 1000
PL clock        = 125000000 Hz
Global timer    = 333333333 Hz (fixed for ~666.666 MHz Cortex-A9)

PL time         = FPGA computation cycle_count only
PS+PL FULL time = weight setup/DMA + 1000 complete inferences
UART output     = excluded from measured region
============================================================

============================================================
 MISCLASSIFICATIONS
============================================================
image[20]: label=1 PL=8
image[59]: label=2 PL=1
image[61]: label=4 PL=9
image[94]: label=2 PL=8
image[110]: label=7 PL=9
image[128]: label=1 PL=8
image[246]: label=3 PL=5
image[273]: label=0 PL=9
image[278]: label=0 PL=4
image[287]: label=6 PL=0
image[316]: label=7 PL=2
image[508]: label=3 PL=5
image[520]: label=4 PL=9
image[527]: label=4 PL=9

============================================================
 FINAL SUMMARY
============================================================
Processed                       : 1000 / 1000
PL accuracy                     : 986 / 1000 = 98.60 %
Misclassifications              : 14
Frame ID errors                 : 0
Protocol errors                 : 0
Core overflows                  : 0
Queue overflows                 : 0

---------------- PL TIME -----------------------------
Total PL cycles                 : 1510442
Average PL cycles               : 1510
Min PL cycles                   : 1504
Max PL cycles                   : 7946
Total PL computation time        : 12.083536 ms
Average PL computation time      : 12.083 us
Steady-state PL avg (1..999)     : 12.032 us
Min PL computation time          : 12.032 us
Max PL computation time          : 63.568 us

---------------- PS+PL FULL TIME ---------------------
PS+PL FULL total time            : 22.589361 ms
PS+PL FULL avg / image           : 22.589 us

---------------- OVERHEAD ----------------------------
Total non-PL time                : 10.505825 ms
Average non-PL / image           : 10.505 us
Full throughput                 : 44268.627 images/s
Pure PL steady throughput       : 83111.702 images/s
PL share of full time           : 53.49 %
Non-PL share of full time       : 46.50 %
End-to-end / PL time ratio      : 1.869 x
============================================================
TEST FINISHED
```


{% endraw %}


## 10. BitMoD v3 전체 기록
{: #record-v3}

<p class="lenet-record-note">원본의 정확도 matrix와 후보 요약, PL 비교 로그·구조도, 최종 PS 로그를 보존했다. 이 기록의 simulation 설정과 최종 보드 설정은 서로 다르며 해석은 앞의 4~6절에 있다.</p>

{% raw %}

<h3 class="lenet-original-heading">LeNet BitMoD v3</h3>

<h3 class="lenet-original-heading">Why 1bit input, 4bit weight</h3>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v3-01.png"><img src="/assets/images/lenet-project-2026/v3-01.png" alt="V3 원본 그림 1 · Why 1bit input, 4bit weight" width="1995" height="2614" loading="lazy" decoding="async"></a><figcaption>V3 원본 그림 1 · Why 1bit input, 4bit weight · 클릭하면 원본 크기로 보기</figcaption></figure>

<h4 class="lenet-original-heading">Accuracy Matrix</h4>

| Weight Scheme | Weight Bits | Granularity | Mode | Group Preset | Image 8-bit Acc | Image 6-bit Acc | Image 4-bit Acc | Image 3-bit Acc | Image 2-bit Acc | Image 1-bit Acc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Original-INT8 | 8 | original | original | - | 98.6000% | 98.7000% | 98.5000% | 98.4000% | 98.2000% | 98.4000% |
| INT2-Sym-PT | 2 | tensor | sym | - | 9.8000% | 9.8000% | 9.8000% | 9.8000% | 10.0000% | 10.6000% |
| INT2-Sym-PC | 2 | channel | sym | - | 33.2000% | 33.0000% | 33.1000% | 32.4000% | 33.6000% | 30.1000% |
| INT2-Asym-PT | 2 | tensor | asym | - | 56.2000% | 56.4000% | 56.2000% | 55.6000% | 56.4000% | 53.3000% |
| INT2-Asym-PC | 2 | channel | asym | - | 68.1000% | 68.4000% | 67.7000% | 67.2000% | 65.9000% | 59.6000% |
| INT3-Sym-PT | 3 | tensor | sym | - | 93.9000% | 93.9000% | 94.2000% | 93.7000% | 93.3000% | 86.8000% |
| INT3-Sym-PC | 3 | channel | sym | - | 97.3000% | 97.4000% | 97.4000% | 97.5000% | 97.1000% | 96.3000% |
| INT3-Asym-PT | 3 | tensor | asym | - | 97.6000% | 97.6000% | 97.6000% | 97.5000% | 97.5000% | 96.0000% |
| INT3-Asym-PC | 3 | channel | asym | - | 98.4000% | 98.4000% | 98.2000% | 98.1000% | 97.4000% | 96.9000% |
| INT4-Sym-PT | 4 | tensor | sym | - | 97.8000% | 97.8000% | 97.9000% | 97.8000% | 97.8000% | 95.8000% |
| INT4-Sym-PC | 4 | channel | sym | - | 98.6000% | 98.6000% | 98.6000% | 98.4000% | 98.3000% | 97.7000% |
| INT4-Asym-PT | 4 | tensor | asym | - | 98.6000% | 98.6000% | 98.5000% | 98.4000% | 98.4000% | 97.9000% |
| INT4-Asym-PC | 4 | channel | asym | - | 98.4000% | 98.3000% | 98.5000% | 98.4000% | 98.1000% | 96.7000% |
| INT5-Sym-PT | 5 | tensor | sym | - | 98.6000% | 98.6000% | 98.6000% | 98.7000% | 98.2000% | 97.4000% |
| INT5-Sym-PC | 5 | channel | sym | - | 98.2000% | 98.2000% | 98.1000% | 98.2000% | 98.2000% | 98.2000% |
| INT5-Asym-PT | 5 | tensor | asym | - | 98.5000% | 98.5000% | 98.4000% | 98.4000% | 98.2000% | 98.5000% |
| INT5-Asym-PC | 5 | channel | asym | - | 98.3000% | 98.3000% | 98.3000% | 98.1000% | 98.2000% | 98.1000% |
| INT6-Sym-PT | 6 | tensor | sym | - | 98.3000% | 98.3000% | 98.4000% | 98.4000% | 98.4000% | 98.3000% |
| INT6-Sym-PC | 6 | channel | sym | - | 98.7000% | 98.6000% | 98.5000% | 98.3000% | 98.3000% | 98.3000% |
| INT6-Asym-PT | 6 | tensor | asym | - | 98.8000% | 98.6000% | 98.7000% | 98.5000% | 98.4000% | 98.4000% |
| INT6-Asym-PC | 6 | channel | asym | - | 98.5000% | 98.6000% | 98.5000% | 98.5000% | 98.1000% | 98.1000% |
| INT8-Sym-PT | 8 | tensor | sym | - | 98.4000% | 98.4000% | 98.5000% | 98.3000% | 98.3000% | 98.4000% |
| INT8-Sym-PC | 8 | channel | sym | - | 98.7000% | 98.5000% | 98.5000% | 98.5000% | 98.2000% | 98.4000% |
| INT8-Asym-PT | 8 | tensor | asym | - | 98.7000% | 98.7000% | 98.6000% | 98.4000% | 98.3000% | 98.4000% |
| INT8-Asym-PC | 8 | channel | asym | - | 98.7000% | 98.7000% | 98.6000% | 98.4000% | 98.2000% | 98.3000% |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 98.4000% | 98.3000% | 98.2000% | 98.2000% | 97.7000% | 97.7000% |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 96.8000% | 96.8000% | 96.8000% | 97.1000% | 97.0000% | 97.0000% |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 98.1000% | 98.0000% | 98.2000% | 98.0000% | 97.9000% | 97.6000% |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 98.4000% | 98.4000% | 98.6000% | 98.5000% | 98.6000% | 98.3000% |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 98.4000% | 98.4000% | 98.3000% | 98.3000% | 98.5000% | 97.9000% |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 98.2000% | 98.2000% | 98.3000% | 98.0000% | 98.3000% | 98.1000% |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 98.7000% | 98.7000% | 98.8000% | 98.7000% | 98.7000% | 98.4000% |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 99.0000% | 99.0000% | 99.0000% | 98.9000% | 98.9000% | 98.2000% |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 98.3000% | 98.3000% | 98.3000% | 98.1000% | 98.1000% | 96.7000% |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 97.8000% | 97.9000% | 97.8000% | 97.9000% | 98.1000% | 97.8000% |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 98.4000% | 98.3000% | 98.2000% | 98.1000% | 98.3000% | 97.5000% |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 98.3000% | 98.3000% | 98.3000% | 98.1000% | 98.2000% | 96.8000% |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 98.5000% | 98.4000% | 98.4000% | 98.3000% | 98.3000% | 98.2000% |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 98.4000% | 98.4000% | 98.4000% | 98.2000% | 98.2000% | 98.3000% |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 98.4000% | 98.4000% | 98.4000% | 98.2000% | 98.2000% | 98.4000% |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 98.7000% | 98.7000% | 98.7000% | 98.6000% | 98.4000% | 98.5000% |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 98.7000% | 98.7000% | 98.5000% | 98.7000% | 98.2000% | 97.8000% |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 98.6000% | 98.6000% | 98.4000% | 98.6000% | 98.2000% | 98.3000% |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 98.7000% | 98.6000% | 98.5000% | 98.5000% | 98.2000% | 98.4000% |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 98.7000% | 98.6000% | 98.5000% | 98.4000% | 98.2000% | 98.4000% |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 98.5000% | 98.5000% | 98.5000% | 98.3000% | 98.2000% | 98.3000% |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 98.6000% | 98.6000% | 98.4000% | 98.4000% | 98.3000% | 98.4000% |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 98.7000% | 98.7000% | 98.6000% | 98.5000% | 98.2000% | 98.4000% |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 98.6000% | 98.7000% | 98.5000% | 98.4000% | 98.2000% | 98.4000% |
| FP3-PT | 3 | tensor | fp | - | 97.8000% | 97.8000% | 97.8000% | 97.7000% | 97.5000% | 97.4000% |
| FP3-PC | 3 | channel | fp | - | 94.2000% | 94.1000% | 94.5000% | 94.3000% | 93.8000% | 91.6000% |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 97.6000% | 97.6000% | 97.8000% | 97.7000% | 97.2000% | 95.9000% |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 98.0000% | 98.0000% | 97.9000% | 98.0000% | 97.9000% | 96.3000% |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 96.8000% | 96.8000% | 96.8000% | 96.7000% | 96.7000% | 95.4000% |
| FP4-PT | 4 | tensor | fp | - | 97.9000% | 97.9000% | 97.9000% | 98.0000% | 97.5000% | 96.9000% |
| FP4-PC | 4 | channel | fp | - | 96.6000% | 96.7000% | 96.9000% | 96.5000% | 96.3000% | 94.8000% |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 98.5000% | 98.5000% | 98.4000% | 98.3000% | 98.5000% | 98.3000% |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 98.0000% | 98.0000% | 97.6000% | 97.7000% | 97.7000% | 96.9000% |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 98.2000% | 98.2000% | 98.3000% | 98.1000% | 98.1000% | 96.9000% |
| FP6-E2M3-PT | 6 | tensor | fp | - | 98.4000% | 98.4000% | 98.4000% | 98.3000% | 98.1000% | 98.2000% |
| FP6-E2M3-PC | 6 | channel | fp | - | 98.6000% | 98.7000% | 98.4000% | 98.5000% | 98.4000% | 98.0000% |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 98.5000% | 98.5000% | 98.6000% | 98.4000% | 98.2000% | 98.2000% |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 98.4000% | 98.4000% | 98.3000% | 98.3000% | 98.2000% | 98.3000% |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 98.8000% | 98.8000% | 98.6000% | 98.5000% | 98.5000% | 98.0000% |
| FP6-E3M2-PT | 6 | tensor | fp | - | 98.7000% | 98.7000% | 98.6000% | 98.7000% | 98.2000% | 98.3000% |
| FP6-E3M2-PC | 6 | channel | fp | - | 98.5000% | 98.5000% | 98.4000% | 98.3000% | 98.2000% | 98.3000% |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 98.8000% | 98.7000% | 98.7000% | 98.7000% | 98.3000% | 98.5000% |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 98.6000% | 98.6000% | 98.6000% | 98.6000% | 98.3000% | 98.8000% |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 98.5000% | 98.5000% | 98.4000% | 98.2000% | 98.2000% | 98.5000% |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 98.1000% | 98.0000% | 98.1000% | 98.0000% | 97.4000% | 96.4000% |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 97.4000% | 97.5000% | 97.6000% | 97.4000% | 97.3000% | 96.2000% |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 98.1000% | 98.1000% | 98.1000% | 97.7000% | 98.0000% | 96.4000% |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 98.6000% | 98.7000% | 98.7000% | 98.5000% | 98.5000% | 98.5000% |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 98.8000% | 98.8000% | 98.7000% | 98.7000% | 98.8000% | 98.1000% |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 98.7000% | 98.8000% | 98.6000% | 98.7000% | 98.4000% | 98.0000% |

- **Quantization Results**

[combined_quantization_results_notion.md](#record-quantization)


| Reason | Weight Scheme | Img | Acc | Delta | Wmem | Imem | Comp | GrpOps | HWscore |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Best Accuracy | INT4-Sym-PG-kernel [25,25,24] | 4 | 99.00% | +0.40 | 1.72× | 2.00× | 2.31× | 5,456 | 1.917 |
| Safe Efficiency (loss ≤ 0.3pp) | INT3-Asym-PG-fine [5,10,16] | 1 | 98.30% | -0.30 | 1.62× | 7.84× | 3.47× | 19,320 | 3.095 |
| Balanced Efficiency (loss ≤ 0.5pp) / RTL-friendly PG | INT3-Asym-PG-coarse [25,50,48] | 1 | 98.10% | -0.50 | 2.28× | 7.84× | 3.47× | 3,880 | 3.851 |
| Aggressive Efficiency (loss ≤ 1.0pp) | INT3-Sym-PG-coarse [25,50,48] | 1 | 97.60% | -1.00 | 2.40× | 7.84× | 3.47× | 3,880 | 3.915 |
| Best BitMoD (loss ≤ 0.5pp) | BitMoD-FP4-Adaptive-PG-kernel [25,25,24] | 1 | 98.10% | -0.50 | 1.81× | 7.84× | 2.61× | 5,456 | 2.525 |

<h3 class="lenet-original-heading">PL 영역</h3>


<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v3-02.png"><img src="/assets/images/lenet-project-2026/v3-02.png" alt="V3 원본 그림 2 · PL 영역" width="1852" height="412" loading="lazy" decoding="async"></a><figcaption>V3 원본 그림 2 · PL 영역 · 클릭하면 원본 크기로 보기</figcaption></figure>



```powershell
============================================================
LeNet V3 BitMoD PARALLELISM COMPARISON
C2_IC_PAR       = 1
FC_PAR          = 2
DOT25_PIPELINED = 1
Clock period    = 6.667 ns
Clock target    = 149.993 MHz
Images          = 1000
============================================================
[TB] 805 original INT8 weight words loaded.
[QPASS] exact BitMoD cache match
[IMG 0] label=4 pred=4 expected=4 cycles=841253 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 1] label=9 pred=9 expected=9 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 2] label=9 pred=9 expected=9 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 3] label=7 pred=7 expected=7 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 4] label=1 pred=1 expected=1 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 5] label=1 pred=1 expected=1 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 6] label=9 pred=9 expected=9 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 7] label=0 pred=0 expected=0 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 8] label=7 pred=7 expected=7 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 9] label=8 pred=8 expected=8 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 99] label=1 pred=1 expected=1 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 199] label=0 pred=0 expected=0 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 299] label=5 pred=5 expected=5 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 399] label=6 pred=6 expected=6 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 499] label=6 pred=6 expected=6 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 599] label=9 pred=9 expected=9 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 699] label=8 pred=8 expected=8 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 799] label=1 pred=1 expected=1 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 899] label=9 pred=9 expected=9 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
[IMG 999] label=0 pred=0 expected=0 cycles=961 | C1=415 C2=830 FC=959 C1/C2ov=415 C2/FCov=830
============================================================
FUNCTIONAL RESULT
Prediction golden mismatches : 0 / 1000
Classification correct       : 983 / 1000
Exact cache mismatches        : 0
Exact logit mismatches (10)   : 0
Overflow flag                 : 0
------------------------------------------------------------
PERFORMANCE RESULT
Cold frame cycles             : 841253
Steady frame cycles           : 961
Clock target                  : 149.993 MHz
Steady latency                : 6.407 us
Theoretical frame throughput  : 156079.6 image/s
V2 reference                  : 1504 cycles
Cycle speedup vs V2           : 1.565x
------------------------------------------------------------
PREDICTION FUNCTIONAL PASS
BIT-TRUE EXACT PASS
============================================================
```




<figure class="lenet-figure"><a href="/assets/images/lenet-project-2026/v3-03.png"><img src="/assets/images/lenet-project-2026/v3-03.png" alt="V3 원본 그림 3 · PL 영역" width="1672" height="941" loading="lazy" decoding="async"></a><figcaption>V3 원본 그림 3 · PL 영역 · 클릭하면 원본 크기로 보기</figcaption></figure>

<h3 class="lenet-original-heading">PS 영역</h3>



```powershell
============================================================
 LeNet-v3 FINAL ACCELERATOR BENCHMARK @160MHz
============================================================
Path            : PS image -> PL inference -> PS result
Images          : 1000
PL clock        : 160.000 MHz
DMA             : Simple DMA + Direct MMIO
Cache           : prebuilt TX + bulk cache maintenance
Cold policy     : image[0] INCLUDED in 1000-image total
============================================================
PS weight hash = e456be42 expected=e456be42 : PASS

[1/2] Uploading weights once...
[2/2] Running PS -> PL -> PS for 1000 images...

============================================================
 FINAL SUMMARY
============================================================
Processed                       : 1000 / 1000
Accuracy                        : 983 / 1000 = 98.30 %
Wrong                           : 17
Status / frame errors           : 0
Weight upload once              : 12.624000 us

---------------- TOTAL TIME : 1000 IMAGES -------------
E2E total                       : 10.753990 ms
PL total                        : 7.239325 ms
Non-PL total                    : 3.514665 ms
E2E + initial weight upload     : 10.766614 ms

---------------- AVERAGE : COLD INCLUDED ---------------
E2E average / image             : 10.753990 us
PL average / image              : 7.239325 us
Non-PL average / image          : 3.514665 us

---------------- STEADY STATE : IMAGE 1..999 -----------
E2E steady / image              : 9.385936 us
PL steady / image               : 6.012500 us
Non-PL steady / image           : 3.373436 us

---------------- COLD START : IMAGE 0 ------------------
E2E cold                        : 1236.284800 us
PL cold                         : 1232.837500 us
Non-PL cold                     : 3.447300 us

---------------- TOTAL CYCLES @160MHz ------------------
E2E equivalent total cycles     : 1720638
PL total cycles                 : 1158292
Non-PL equivalent total cycles  : 562346

---------------- AVG CYCLES @160MHz --------------------
E2E equivalent cycles / image   : 1720.638
PL cycles / image               : 1158.292
Non-PL equivalent cycles/image  : 562.346

---------------- STEADY CYCLES @160MHz -----------------
E2E steady equivalent cycles    : 1501.750
PL steady cycles                : 962.000
Non-PL steady equivalent cycles : 539.750

---------------- COLD CYCLES @160MHz -------------------
E2E cold equivalent cycles      : 197805.568
PL cold cycles                  : 197254
Non-PL cold equivalent cycles   : 551.568

---------------- THROUGHPUT ----------------------------
1000-image E2E throughput       : 92988.738 images/s
Steady E2E throughput           : 106542.380 images/s
Pure PL steady throughput       : 166320.166 images/s

---------------- VS TRUE BASELINE ----------------------
Baseline accuracy               : 98.40 %
Current accuracy                : 98.30 %
Accuracy difference             : -0.10 pp

Baseline E2E total              : 8760.471 ms
Current E2E total               : 10.753990 ms
E2E total speedup               : 814.625 x

Baseline PL total               : 8686.600 ms
Current PL total                : 7.239325 ms
PL total speedup                : 1199.919 x

Baseline non-PL total           : 73.871 ms
Current non-PL total            : 3.514665 ms
Non-PL total reduction          : 95.24 %

Baseline PL cycles / image      : 434330
Current steady PL cycles        : 962
PL cycle reduction              : 99.78 %

---------------- V2 -> V3 PL ---------------------------
V2 steady PL                    : 1504 cycles @125 MHz
V2 PL latency                   : 12.032000 us
V3 steady PL                    : 962 cycles @160 MHz
V3 PL latency                   : 6.012500 us
V2 -> V3 cycle reduction        : 36.04 %
V2 -> V3 frequency increase     : 28.00 %
V2 -> V3 PL latency speedup     : 2.001 x
============================================================
RESULT                          : PASS
Behavioral accuracy baseline    : 98.30 %
============================================================
TEST FINISHED
```


{% endraw %}


## 11. 양자화 실험 450개 전체 결과
{: #record-quantization}

<p class="lenet-record-note">v3 페이지의 별도 첨부 문서를 본문에 통합했다. 75개 Weight Scheme × 6개 Image Bits의 450행과 20개 열을 모두 보존했다. 가로로 스크롤하면 저장량과 추정 비용 열까지 볼 수 있다.</p>

{% raw %}

<h3 class="lenet-original-heading">Quantization Results</h3>

> Source: `combined_quantization_results(1).csv`
> Rows: 450 / Columns: 20

| Weight Scheme | Weight Bits | Weight Granularity | Weight Mode | Group Preset | Image Bits | Correct | Total | Accuracy (%) | Δ vs Original8 (pp) | Elapsed (s) | Weight Storage (bits) | Weight Storage (bytes) | W-Mem Comp (×) | Image Words (32b) | I-Mem Comp (×) | Compute Proxy (×) | Group Rescale Ops/Image | Group Penalty | HW Efficiency Score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Original-INT8 | 8 | original | original | - | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.080856 | 25,760 | 3,220 | 1.000× | 196 | 1.000× | 1.000× | 0 | 1.000 | 1.000 |
| Original-INT8 | 8 | original | original | - | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.081655 | 25,760 | 3,220 | 1.000× | 147 | 1.333× | 1.071× | 0 | 1.000 | 1.126 |
| Original-INT8 | 8 | original | original | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.084085 | 25,760 | 3,220 | 1.000× | 98 | 2.000× | 1.153× | 0 | 1.000 | 1.321 |
| Original-INT8 | 8 | original | original | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.082200 | 25,760 | 3,220 | 1.000× | 74 | 2.649× | 1.199× | 0 | 1.000 | 1.470 |
| Original-INT8 | 8 | original | original | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.085431 | 25,760 | 3,220 | 1.000× | 49 | 4.000× | 1.249× | 0 | 1.000 | 1.709 |
| Original-INT8 | 8 | original | original | - | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.084772 | 25,760 | 3,220 | 1.000× | 25 | 7.840× | 1.303× | 0 | 1.000 | 2.170 |
| INT2-Sym-PT | 2 | tensor | sym | - | 8 | 98 | 1,000 | 9.80% | -88.80 | 0.083334 | 6,488 | 811 | 3.970× | 196 | 1.000× | 4.000× | 0 | 1.000 | 2.514 |
| INT2-Sym-PT | 2 | tensor | sym | - | 6 | 98 | 1,000 | 9.80% | -88.80 | 0.083220 | 6,488 | 811 | 3.970× | 147 | 1.333× | 4.284× | 0 | 1.000 | 2.831 |
| INT2-Sym-PT | 2 | tensor | sym | - | 4 | 98 | 1,000 | 9.80% | -88.80 | 0.081900 | 6,488 | 811 | 3.970× | 98 | 2.000× | 4.612× | 0 | 1.000 | 3.321 |
| INT2-Sym-PT | 2 | tensor | sym | - | 3 | 98 | 1,000 | 9.80% | -88.80 | 0.082302 | 6,488 | 811 | 3.970× | 74 | 2.649× | 4.796× | 0 | 1.000 | 3.695 |
| INT2-Sym-PT | 2 | tensor | sym | - | 2 | 100 | 1,000 | 10.00% | -88.60 | 0.082967 | 6,488 | 811 | 3.970× | 49 | 4.000× | 4.994× | 0 | 1.000 | 4.297 |
| INT2-Sym-PT | 2 | tensor | sym | - | 1 | 106 | 1,000 | 10.60% | -88.00 | 0.082659 | 6,488 | 811 | 3.970× | 25 | 7.840× | 5.210× | 0 | 1.000 | 5.453 |
| INT2-Sym-PC | 2 | channel | sym | - | 8 | 332 | 1,000 | 33.20% | -65.40 | 0.081615 | 6,856 | 857 | 3.757× | 196 | 1.000× | 4.000× | 0 | 1.000 | 2.468 |
| INT2-Sym-PC | 2 | channel | sym | - | 6 | 330 | 1,000 | 33.00% | -65.60 | 0.082332 | 6,856 | 857 | 3.757× | 147 | 1.333× | 4.284× | 0 | 1.000 | 2.779 |
| INT2-Sym-PC | 2 | channel | sym | - | 4 | 331 | 1,000 | 33.10% | -65.50 | 0.082914 | 6,856 | 857 | 3.757× | 98 | 2.000× | 4.612× | 0 | 1.000 | 3.260 |
| INT2-Sym-PC | 2 | channel | sym | - | 3 | 324 | 1,000 | 32.40% | -66.20 | 0.085619 | 6,856 | 857 | 3.757× | 74 | 2.649× | 4.796× | 0 | 1.000 | 3.627 |
| INT2-Sym-PC | 2 | channel | sym | - | 2 | 336 | 1,000 | 33.60% | -65.00 | 0.103021 | 6,856 | 857 | 3.757× | 49 | 4.000× | 4.994× | 0 | 1.000 | 4.218 |
| INT2-Sym-PC | 2 | channel | sym | - | 1 | 301 | 1,000 | 30.10% | -68.50 | 0.097866 | 6,856 | 857 | 3.757× | 25 | 7.840× | 5.210× | 0 | 1.000 | 5.354 |
| INT2-Asym-PT | 2 | tensor | asym | - | 8 | 562 | 1,000 | 56.20% | -42.40 | 0.112874 | 6,512 | 814 | 3.956× | 196 | 1.000× | 4.000× | 0 | 1.000 | 2.511 |
| INT2-Asym-PT | 2 | tensor | asym | - | 6 | 564 | 1,000 | 56.40% | -42.20 | 0.078089 | 6,512 | 814 | 3.956× | 147 | 1.333× | 4.284× | 0 | 1.000 | 2.827 |
| INT2-Asym-PT | 2 | tensor | asym | - | 4 | 562 | 1,000 | 56.20% | -42.40 | 0.086470 | 6,512 | 814 | 3.956× | 98 | 2.000× | 4.612× | 0 | 1.000 | 3.317 |
| INT2-Asym-PT | 2 | tensor | asym | - | 3 | 556 | 1,000 | 55.60% | -43.00 | 0.077387 | 6,512 | 814 | 3.956× | 74 | 2.649× | 4.796× | 0 | 1.000 | 3.690 |
| INT2-Asym-PT | 2 | tensor | asym | - | 2 | 564 | 1,000 | 56.40% | -42.20 | 0.079836 | 6,512 | 814 | 3.956× | 49 | 4.000× | 4.994× | 0 | 1.000 | 4.291 |
| INT2-Asym-PT | 2 | tensor | asym | - | 1 | 533 | 1,000 | 53.30% | -45.30 | 0.077663 | 6,512 | 814 | 3.956× | 25 | 7.840× | 5.210× | 0 | 1.000 | 5.447 |
| INT2-Asym-PC | 2 | channel | asym | - | 8 | 681 | 1,000 | 68.10% | -30.50 | 0.077005 | 7,064 | 883 | 3.647× | 196 | 1.000× | 4.000× | 0 | 1.000 | 2.443 |
| INT2-Asym-PC | 2 | channel | asym | - | 6 | 684 | 1,000 | 68.40% | -30.20 | 0.078812 | 7,064 | 883 | 3.647× | 147 | 1.333× | 4.284× | 0 | 1.000 | 2.752 |
| INT2-Asym-PC | 2 | channel | asym | - | 4 | 677 | 1,000 | 67.70% | -30.90 | 0.079011 | 7,064 | 883 | 3.647× | 98 | 2.000× | 4.612× | 0 | 1.000 | 3.228 |
| INT2-Asym-PC | 2 | channel | asym | - | 3 | 672 | 1,000 | 67.20% | -31.40 | 0.078184 | 7,064 | 883 | 3.647× | 74 | 2.649× | 4.796× | 0 | 1.000 | 3.591 |
| INT2-Asym-PC | 2 | channel | asym | - | 2 | 659 | 1,000 | 65.90% | -32.70 | 0.079999 | 7,064 | 883 | 3.647× | 49 | 4.000× | 4.994× | 0 | 1.000 | 4.177 |
| INT2-Asym-PC | 2 | channel | asym | - | 1 | 596 | 1,000 | 59.60% | -39.00 | 0.082114 | 7,064 | 883 | 3.647× | 25 | 7.840× | 5.210× | 0 | 1.000 | 5.301 |
| INT3-Sym-PT | 3 | tensor | sym | - | 8 | 939 | 1,000 | 93.90% | -4.70 | 0.078674 | 9,708 | 1,214 | 2.653× | 196 | 1.000× | 2.667× | 0 | 1.000 | 1.920 |
| INT3-Sym-PT | 3 | tensor | sym | - | 6 | 939 | 1,000 | 93.90% | -4.70 | 0.077655 | 9,708 | 1,214 | 2.653× | 147 | 1.333× | 2.856× | 0 | 1.000 | 2.162 |
| INT3-Sym-PT | 3 | tensor | sym | - | 4 | 942 | 1,000 | 94.20% | -4.40 | 0.109785 | 9,708 | 1,214 | 2.653× | 98 | 2.000× | 3.075× | 0 | 1.000 | 2.536 |
| INT3-Sym-PT | 3 | tensor | sym | - | 3 | 937 | 1,000 | 93.70% | -4.90 | 0.078539 | 9,708 | 1,214 | 2.653× | 74 | 2.649× | 3.197× | 0 | 1.000 | 2.822 |
| INT3-Sym-PT | 3 | tensor | sym | - | 2 | 933 | 1,000 | 93.30% | -5.30 | 0.088919 | 9,708 | 1,214 | 2.653× | 49 | 4.000× | 3.330× | 0 | 1.000 | 3.282 |
| INT3-Sym-PT | 3 | tensor | sym | - | 1 | 868 | 1,000 | 86.80% | -11.80 | 0.082124 | 9,708 | 1,214 | 2.653× | 25 | 7.840× | 3.474× | 0 | 1.000 | 4.165 |
| INT3-Sym-PC | 3 | channel | sym | - | 8 | 973 | 1,000 | 97.30% | -1.30 | 0.077287 | 10,076 | 1,260 | 2.557× | 196 | 1.000× | 2.667× | 0 | 1.000 | 1.896 |
| INT3-Sym-PC | 3 | channel | sym | - | 6 | 974 | 1,000 | 97.40% | -1.20 | 0.078484 | 10,076 | 1,260 | 2.557× | 147 | 1.333× | 2.856× | 0 | 1.000 | 2.135 |
| INT3-Sym-PC | 3 | channel | sym | - | 4 | 974 | 1,000 | 97.40% | -1.20 | 0.077790 | 10,076 | 1,260 | 2.557× | 98 | 2.000× | 3.075× | 0 | 1.000 | 2.505 |
| INT3-Sym-PC | 3 | channel | sym | - | 3 | 975 | 1,000 | 97.50% | -1.10 | 0.078001 | 10,076 | 1,260 | 2.557× | 74 | 2.649× | 3.197× | 0 | 1.000 | 2.787 |
| INT3-Sym-PC | 3 | channel | sym | - | 2 | 971 | 1,000 | 97.10% | -1.50 | 0.081907 | 10,076 | 1,260 | 2.557× | 49 | 4.000× | 3.330× | 0 | 1.000 | 3.241 |
| INT3-Sym-PC | 3 | channel | sym | - | 1 | 963 | 1,000 | 96.30% | -2.30 | 0.084257 | 10,076 | 1,260 | 2.557× | 25 | 7.840× | 3.474× | 0 | 1.000 | 4.114 |
| INT3-Asym-PT | 3 | tensor | asym | - | 8 | 976 | 1,000 | 97.60% | -1.00 | 0.099806 | 9,732 | 1,217 | 2.647× | 196 | 1.000× | 2.667× | 0 | 1.000 | 1.918 |
| INT3-Asym-PT | 3 | tensor | asym | - | 6 | 976 | 1,000 | 97.60% | -1.00 | 0.077362 | 9,732 | 1,217 | 2.647× | 147 | 1.333× | 2.856× | 0 | 1.000 | 2.160 |
| INT3-Asym-PT | 3 | tensor | asym | - | 4 | 976 | 1,000 | 97.60% | -1.00 | 0.077092 | 9,732 | 1,217 | 2.647× | 98 | 2.000× | 3.075× | 0 | 1.000 | 2.534 |
| INT3-Asym-PT | 3 | tensor | asym | - | 3 | 975 | 1,000 | 97.50% | -1.10 | 0.081493 | 9,732 | 1,217 | 2.647× | 74 | 2.649× | 3.197× | 0 | 1.000 | 2.820 |
| INT3-Asym-PT | 3 | tensor | asym | - | 2 | 975 | 1,000 | 97.50% | -1.10 | 0.076927 | 9,732 | 1,217 | 2.647× | 49 | 4.000× | 3.330× | 0 | 1.000 | 3.279 |
| INT3-Asym-PT | 3 | tensor | asym | - | 1 | 960 | 1,000 | 96.00% | -2.60 | 0.076917 | 9,732 | 1,217 | 2.647× | 25 | 7.840× | 3.474× | 0 | 1.000 | 4.162 |
| INT3-Asym-PC | 3 | channel | asym | - | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.079380 | 10,284 | 1,286 | 2.505× | 196 | 1.000× | 2.667× | 0 | 1.000 | 1.883 |
| INT3-Asym-PC | 3 | channel | asym | - | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.077142 | 10,284 | 1,286 | 2.505× | 147 | 1.333× | 2.856× | 0 | 1.000 | 2.121 |
| INT3-Asym-PC | 3 | channel | asym | - | 4 | 982 | 1,000 | 98.20% | -0.40 | 0.078981 | 10,284 | 1,286 | 2.505× | 98 | 2.000× | 3.075× | 0 | 1.000 | 2.488 |
| INT3-Asym-PC | 3 | channel | asym | - | 3 | 981 | 1,000 | 98.10% | -0.50 | 0.111459 | 10,284 | 1,286 | 2.505× | 74 | 2.649× | 3.197× | 0 | 1.000 | 2.768 |
| INT3-Asym-PC | 3 | channel | asym | - | 2 | 974 | 1,000 | 97.40% | -1.20 | 0.088673 | 10,284 | 1,286 | 2.505× | 49 | 4.000× | 3.330× | 0 | 1.000 | 3.219 |
| INT3-Asym-PC | 3 | channel | asym | - | 1 | 969 | 1,000 | 96.90% | -1.70 | 0.084439 | 10,284 | 1,286 | 2.505× | 25 | 7.840× | 3.474× | 0 | 1.000 | 4.086 |
| INT4-Sym-PT | 4 | tensor | sym | - | 8 | 978 | 1,000 | 97.80% | -0.80 | 0.084657 | 12,928 | 1,616 | 1.993× | 196 | 1.000× | 2.000× | 0 | 1.000 | 1.585 |
| INT4-Sym-PT | 4 | tensor | sym | - | 6 | 978 | 1,000 | 97.80% | -0.80 | 0.079201 | 12,928 | 1,616 | 1.993× | 147 | 1.333× | 2.142× | 0 | 1.000 | 1.785 |
| INT4-Sym-PT | 4 | tensor | sym | - | 4 | 979 | 1,000 | 97.90% | -0.70 | 0.078349 | 12,928 | 1,616 | 1.993× | 98 | 2.000× | 2.306× | 0 | 1.000 | 2.095 |
| INT4-Sym-PT | 4 | tensor | sym | - | 3 | 978 | 1,000 | 97.80% | -0.80 | 0.080248 | 12,928 | 1,616 | 1.993× | 74 | 2.649× | 2.398× | 0 | 1.000 | 2.330 |
| INT4-Sym-PT | 4 | tensor | sym | - | 2 | 978 | 1,000 | 97.80% | -0.80 | 0.079034 | 12,928 | 1,616 | 1.993× | 49 | 4.000× | 2.497× | 0 | 1.000 | 2.710 |
| INT4-Sym-PT | 4 | tensor | sym | - | 1 | 958 | 1,000 | 95.80% | -2.80 | 0.078651 | 12,928 | 1,616 | 1.993× | 25 | 7.840× | 2.605× | 0 | 1.000 | 3.440 |
| INT4-Sym-PC | 4 | channel | sym | - | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.078329 | 13,296 | 1,662 | 1.937× | 196 | 1.000× | 2.000× | 0 | 1.000 | 1.571 |
| INT4-Sym-PC | 4 | channel | sym | - | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.077261 | 13,296 | 1,662 | 1.937× | 147 | 1.333× | 2.142× | 0 | 1.000 | 1.769 |
| INT4-Sym-PC | 4 | channel | sym | - | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.078990 | 13,296 | 1,662 | 1.937× | 98 | 2.000× | 2.306× | 0 | 1.000 | 2.075 |
| INT4-Sym-PC | 4 | channel | sym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.079416 | 13,296 | 1,662 | 1.937× | 74 | 2.649× | 2.398× | 0 | 1.000 | 2.309 |
| INT4-Sym-PC | 4 | channel | sym | - | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.077660 | 13,296 | 1,662 | 1.937× | 49 | 4.000× | 2.497× | 0 | 1.000 | 2.685 |
| INT4-Sym-PC | 4 | channel | sym | - | 1 | 977 | 1,000 | 97.70% | -0.90 | 0.089873 | 13,296 | 1,662 | 1.937× | 25 | 7.840× | 2.605× | 0 | 1.000 | 3.408 |
| INT4-Asym-PT | 4 | tensor | asym | - | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.079180 | 12,952 | 1,619 | 1.989× | 196 | 1.000× | 2.000× | 0 | 1.000 | 1.584 |
| INT4-Asym-PT | 4 | tensor | asym | - | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.079190 | 12,952 | 1,619 | 1.989× | 147 | 1.333× | 2.142× | 0 | 1.000 | 1.784 |
| INT4-Asym-PT | 4 | tensor | asym | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.077845 | 12,952 | 1,619 | 1.989× | 98 | 2.000× | 2.306× | 0 | 1.000 | 2.093 |
| INT4-Asym-PT | 4 | tensor | asym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.077748 | 12,952 | 1,619 | 1.989× | 74 | 2.649× | 2.398× | 0 | 1.000 | 2.329 |
| INT4-Asym-PT | 4 | tensor | asym | - | 2 | 984 | 1,000 | 98.40% | -0.20 | 0.080919 | 12,952 | 1,619 | 1.989× | 49 | 4.000× | 2.497× | 0 | 1.000 | 2.708 |
| INT4-Asym-PT | 4 | tensor | asym | - | 1 | 979 | 1,000 | 97.90% | -0.70 | 0.077700 | 12,952 | 1,619 | 1.989× | 25 | 7.840× | 2.605× | 0 | 1.000 | 3.438 |
| INT4-Asym-PC | 4 | channel | asym | - | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.077836 | 13,504 | 1,688 | 1.908× | 196 | 1.000× | 2.000× | 0 | 1.000 | 1.563 |
| INT4-Asym-PC | 4 | channel | asym | - | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.105614 | 13,504 | 1,688 | 1.908× | 147 | 1.333× | 2.142× | 0 | 1.000 | 1.760 |
| INT4-Asym-PC | 4 | channel | asym | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.079082 | 13,504 | 1,688 | 1.908× | 98 | 2.000× | 2.306× | 0 | 1.000 | 2.064 |
| INT4-Asym-PC | 4 | channel | asym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.083053 | 13,504 | 1,688 | 1.908× | 74 | 2.649× | 2.398× | 0 | 1.000 | 2.297 |
| INT4-Asym-PC | 4 | channel | asym | - | 2 | 981 | 1,000 | 98.10% | -0.50 | 0.097584 | 13,504 | 1,688 | 1.908× | 49 | 4.000× | 2.497× | 0 | 1.000 | 2.671 |
| INT4-Asym-PC | 4 | channel | asym | - | 1 | 967 | 1,000 | 96.70% | -1.90 | 0.096151 | 13,504 | 1,688 | 1.908× | 25 | 7.840× | 2.605× | 0 | 1.000 | 3.390 |
| INT5-Sym-PT | 5 | tensor | sym | - | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.082748 | 16,148 | 2,019 | 1.595× | 196 | 1.000× | 1.600× | 0 | 1.000 | 1.367 |
| INT5-Sym-PT | 5 | tensor | sym | - | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.120077 | 16,148 | 2,019 | 1.595× | 147 | 1.333× | 1.714× | 0 | 1.000 | 1.539 |
| INT5-Sym-PT | 5 | tensor | sym | - | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.079039 | 16,148 | 2,019 | 1.595× | 98 | 2.000× | 1.845× | 0 | 1.000 | 1.806 |
| INT5-Sym-PT | 5 | tensor | sym | - | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.092162 | 16,148 | 2,019 | 1.595× | 74 | 2.649× | 1.918× | 0 | 1.000 | 2.009 |
| INT5-Sym-PT | 5 | tensor | sym | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.089390 | 16,148 | 2,019 | 1.595× | 49 | 4.000× | 1.998× | 0 | 1.000 | 2.336 |
| INT5-Sym-PT | 5 | tensor | sym | - | 1 | 974 | 1,000 | 97.40% | -1.20 | 0.092715 | 16,148 | 2,019 | 1.595× | 25 | 7.840× | 2.084× | 0 | 1.000 | 2.965 |
| INT5-Sym-PC | 5 | channel | sym | - | 8 | 982 | 1,000 | 98.20% | -0.40 | 0.078705 | 16,516 | 2,065 | 1.560× | 196 | 1.000× | 1.600× | 0 | 1.000 | 1.356 |
| INT5-Sym-PC | 5 | channel | sym | - | 6 | 982 | 1,000 | 98.20% | -0.40 | 0.088527 | 16,516 | 2,065 | 1.560× | 147 | 1.333× | 1.714× | 0 | 1.000 | 1.527 |
| INT5-Sym-PC | 5 | channel | sym | - | 4 | 981 | 1,000 | 98.10% | -0.50 | 0.097653 | 16,516 | 2,065 | 1.560× | 98 | 2.000× | 1.845× | 0 | 1.000 | 1.792 |
| INT5-Sym-PC | 5 | channel | sym | - | 3 | 982 | 1,000 | 98.20% | -0.40 | 0.076495 | 16,516 | 2,065 | 1.560× | 74 | 2.649× | 1.918× | 0 | 1.000 | 1.994 |
| INT5-Sym-PC | 5 | channel | sym | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.075281 | 16,516 | 2,065 | 1.560× | 49 | 4.000× | 1.998× | 0 | 1.000 | 2.319 |
| INT5-Sym-PC | 5 | channel | sym | - | 1 | 982 | 1,000 | 98.20% | -0.40 | 0.079106 | 16,516 | 2,065 | 1.560× | 25 | 7.840× | 2.084× | 0 | 1.000 | 2.943 |
| INT5-Asym-PT | 5 | tensor | asym | - | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.075139 | 16,172 | 2,022 | 1.593× | 196 | 1.000× | 1.600× | 0 | 1.000 | 1.366 |
| INT5-Asym-PT | 5 | tensor | asym | - | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.077730 | 16,172 | 2,022 | 1.593× | 147 | 1.333× | 1.714× | 0 | 1.000 | 1.538 |
| INT5-Asym-PT | 5 | tensor | asym | - | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.074093 | 16,172 | 2,022 | 1.593× | 98 | 2.000× | 1.845× | 0 | 1.000 | 1.805 |
| INT5-Asym-PT | 5 | tensor | asym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.075070 | 16,172 | 2,022 | 1.593× | 74 | 2.649× | 1.918× | 0 | 1.000 | 2.008 |
| INT5-Asym-PT | 5 | tensor | asym | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.073878 | 16,172 | 2,022 | 1.593× | 49 | 4.000× | 1.998× | 0 | 1.000 | 2.335 |
| INT5-Asym-PT | 5 | tensor | asym | - | 1 | 985 | 1,000 | 98.50% | -0.10 | 0.073706 | 16,172 | 2,022 | 1.593× | 25 | 7.840× | 2.084× | 0 | 1.000 | 2.964 |
| INT5-Asym-PC | 5 | channel | asym | - | 8 | 983 | 1,000 | 98.30% | -0.30 | 0.074700 | 16,724 | 2,091 | 1.540× | 196 | 1.000× | 1.600× | 0 | 1.000 | 1.351 |
| INT5-Asym-PC | 5 | channel | asym | - | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.074749 | 16,724 | 2,091 | 1.540× | 147 | 1.333× | 1.714× | 0 | 1.000 | 1.521 |
| INT5-Asym-PC | 5 | channel | asym | - | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.076918 | 16,724 | 2,091 | 1.540× | 98 | 2.000× | 1.845× | 0 | 1.000 | 1.785 |
| INT5-Asym-PC | 5 | channel | asym | - | 3 | 981 | 1,000 | 98.10% | -0.50 | 0.077041 | 16,724 | 2,091 | 1.540× | 74 | 2.649× | 1.918× | 0 | 1.000 | 1.985 |
| INT5-Asym-PC | 5 | channel | asym | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.079052 | 16,724 | 2,091 | 1.540× | 49 | 4.000× | 1.998× | 0 | 1.000 | 2.309 |
| INT5-Asym-PC | 5 | channel | asym | - | 1 | 981 | 1,000 | 98.10% | -0.50 | 0.076661 | 16,724 | 2,091 | 1.540× | 25 | 7.840× | 2.084× | 0 | 1.000 | 2.931 |
| INT6-Sym-PT | 6 | tensor | sym | - | 8 | 983 | 1,000 | 98.30% | -0.30 | 0.080850 | 19,368 | 2,421 | 1.330× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.210 |
| INT6-Sym-PT | 6 | tensor | sym | - | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.083193 | 19,368 | 2,421 | 1.330× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.363 |
| INT6-Sym-PT | 6 | tensor | sym | - | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.108057 | 19,368 | 2,421 | 1.330× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.599 |
| INT6-Sym-PT | 6 | tensor | sym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.074977 | 19,368 | 2,421 | 1.330× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.779 |
| INT6-Sym-PT | 6 | tensor | sym | - | 2 | 984 | 1,000 | 98.40% | -0.20 | 0.075151 | 19,368 | 2,421 | 1.330× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.069 |
| INT6-Sym-PT | 6 | tensor | sym | - | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.075870 | 19,368 | 2,421 | 1.330× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.626 |
| INT6-Sym-PC | 6 | channel | sym | - | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.074619 | 19,736 | 2,467 | 1.305× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.203 |
| INT6-Sym-PC | 6 | channel | sym | - | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.075329 | 19,736 | 2,467 | 1.305× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.355 |
| INT6-Sym-PC | 6 | channel | sym | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.075120 | 19,736 | 2,467 | 1.305× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.589 |
| INT6-Sym-PC | 6 | channel | sym | - | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.075717 | 19,736 | 2,467 | 1.305× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.768 |
| INT6-Sym-PC | 6 | channel | sym | - | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.075605 | 19,736 | 2,467 | 1.305× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.056 |
| INT6-Sym-PC | 6 | channel | sym | - | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.074999 | 19,736 | 2,467 | 1.305× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.610 |
| INT6-Asym-PT | 6 | tensor | asym | - | 8 | 988 | 1,000 | 98.80% | +0.20 | 0.077582 | 19,392 | 2,424 | 1.328× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.210 |
| INT6-Asym-PT | 6 | tensor | asym | - | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.077137 | 19,392 | 2,424 | 1.328× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.363 |
| INT6-Asym-PT | 6 | tensor | asym | - | 4 | 987 | 1,000 | 98.70% | +0.10 | 0.076230 | 19,392 | 2,424 | 1.328× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.599 |
| INT6-Asym-PT | 6 | tensor | asym | - | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.075304 | 19,392 | 2,424 | 1.328× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.778 |
| INT6-Asym-PT | 6 | tensor | asym | - | 2 | 984 | 1,000 | 98.40% | -0.20 | 0.100580 | 19,392 | 2,424 | 1.328× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.068 |
| INT6-Asym-PT | 6 | tensor | asym | - | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.076620 | 19,392 | 2,424 | 1.328× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.625 |
| INT6-Asym-PC | 6 | channel | asym | - | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.081091 | 19,944 | 2,493 | 1.292× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.199 |
| INT6-Asym-PC | 6 | channel | asym | - | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.078661 | 19,944 | 2,493 | 1.292× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.350 |
| INT6-Asym-PC | 6 | channel | asym | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.075594 | 19,944 | 2,493 | 1.292× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.584 |
| INT6-Asym-PC | 6 | channel | asym | - | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.076086 | 19,944 | 2,493 | 1.292× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.762 |
| INT6-Asym-PC | 6 | channel | asym | - | 2 | 981 | 1,000 | 98.10% | -0.50 | 0.075533 | 19,944 | 2,493 | 1.292× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.049 |
| INT6-Asym-PC | 6 | channel | asym | - | 1 | 981 | 1,000 | 98.10% | -0.50 | 0.078440 | 19,944 | 2,493 | 1.292× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.601 |
| INT8-Sym-PT | 8 | tensor | sym | - | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.079448 | 25,808 | 3,226 | 0.998× | 196 | 1.000× | 1.000× | 0 | 1.000 | 0.999 |
| INT8-Sym-PT | 8 | tensor | sym | - | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.080028 | 25,808 | 3,226 | 0.998× | 147 | 1.333× | 1.071× | 0 | 1.000 | 1.125 |
| INT8-Sym-PT | 8 | tensor | sym | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.088380 | 25,808 | 3,226 | 0.998× | 98 | 2.000× | 1.153× | 0 | 1.000 | 1.320 |
| INT8-Sym-PT | 8 | tensor | sym | - | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.076055 | 25,808 | 3,226 | 0.998× | 74 | 2.649× | 1.199× | 0 | 1.000 | 1.469 |
| INT8-Sym-PT | 8 | tensor | sym | - | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.076976 | 25,808 | 3,226 | 0.998× | 49 | 4.000× | 1.249× | 0 | 1.000 | 1.708 |
| INT8-Sym-PT | 8 | tensor | sym | - | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.078893 | 25,808 | 3,226 | 0.998× | 25 | 7.840× | 1.303× | 0 | 1.000 | 2.168 |
| INT8-Sym-PC | 8 | channel | sym | - | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.077881 | 26,176 | 3,272 | 0.984× | 196 | 1.000× | 1.000× | 0 | 1.000 | 0.995 |
| INT8-Sym-PC | 8 | channel | sym | - | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.083004 | 26,176 | 3,272 | 0.984× | 147 | 1.333× | 1.071× | 0 | 1.000 | 1.120 |
| INT8-Sym-PC | 8 | channel | sym | - | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.076641 | 26,176 | 3,272 | 0.984× | 98 | 2.000× | 1.153× | 0 | 1.000 | 1.314 |
| INT8-Sym-PC | 8 | channel | sym | - | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.077984 | 26,176 | 3,272 | 0.984× | 74 | 2.649× | 1.199× | 0 | 1.000 | 1.462 |
| INT8-Sym-PC | 8 | channel | sym | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.077162 | 26,176 | 3,272 | 0.984× | 49 | 4.000× | 1.249× | 0 | 1.000 | 1.700 |
| INT8-Sym-PC | 8 | channel | sym | - | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.076834 | 26,176 | 3,272 | 0.984× | 25 | 7.840× | 1.303× | 0 | 1.000 | 2.158 |
| INT8-Asym-PT | 8 | tensor | asym | - | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.078842 | 25,832 | 3,229 | 0.997× | 196 | 1.000× | 1.000× | 0 | 1.000 | 0.999 |
| INT8-Asym-PT | 8 | tensor | asym | - | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.076922 | 25,832 | 3,229 | 0.997× | 147 | 1.333× | 1.071× | 0 | 1.000 | 1.125 |
| INT8-Asym-PT | 8 | tensor | asym | - | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.082991 | 25,832 | 3,229 | 0.997× | 98 | 2.000× | 1.153× | 0 | 1.000 | 1.320 |
| INT8-Asym-PT | 8 | tensor | asym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.080495 | 25,832 | 3,229 | 0.997× | 74 | 2.649× | 1.199× | 0 | 1.000 | 1.468 |
| INT8-Asym-PT | 8 | tensor | asym | - | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.077367 | 25,832 | 3,229 | 0.997× | 49 | 4.000× | 1.249× | 0 | 1.000 | 1.708 |
| INT8-Asym-PT | 8 | tensor | asym | - | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.077036 | 25,832 | 3,229 | 0.997× | 25 | 7.840× | 1.303× | 0 | 1.000 | 2.168 |
| INT8-Asym-PC | 8 | channel | asym | - | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.076381 | 26,384 | 3,298 | 0.976× | 196 | 1.000× | 1.000× | 0 | 1.000 | 0.992 |
| INT8-Asym-PC | 8 | channel | asym | - | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.095070 | 26,384 | 3,298 | 0.976× | 147 | 1.333× | 1.071× | 0 | 1.000 | 1.117 |
| INT8-Asym-PC | 8 | channel | asym | - | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.079941 | 26,384 | 3,298 | 0.976× | 98 | 2.000× | 1.153× | 0 | 1.000 | 1.311 |
| INT8-Asym-PC | 8 | channel | asym | - | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.077386 | 26,384 | 3,298 | 0.976× | 74 | 2.649× | 1.199× | 0 | 1.000 | 1.458 |
| INT8-Asym-PC | 8 | channel | asym | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.075589 | 26,384 | 3,298 | 0.976× | 49 | 4.000× | 1.249× | 0 | 1.000 | 1.696 |
| INT8-Asym-PC | 8 | channel | asym | - | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.076162 | 26,384 | 3,298 | 0.976× | 25 | 7.840× | 1.303× | 0 | 1.000 | 2.152 |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.075508 | 13,820 | 1,728 | 1.864× | 196 | 1.000× | 2.667× | 19,320 | 1.142 | 1.495 |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.122390 | 13,820 | 1,728 | 1.864× | 147 | 1.333× | 2.856× | 19,320 | 1.142 | 1.683 |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 4 | 982 | 1,000 | 98.20% | -0.40 | 0.106261 | 13,820 | 1,728 | 1.864× | 98 | 2.000× | 3.075× | 19,320 | 1.142 | 1.975 |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 3 | 982 | 1,000 | 98.20% | -0.40 | 0.091589 | 13,820 | 1,728 | 1.864× | 74 | 2.649× | 3.197× | 19,320 | 1.142 | 2.197 |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 2 | 977 | 1,000 | 97.70% | -0.90 | 0.081624 | 13,820 | 1,728 | 1.864× | 49 | 4.000× | 3.330× | 19,320 | 1.142 | 2.555 |
| INT3-Sym-PG-fine[5,10,16] | 3 | group | sym | fine | 1 | 977 | 1,000 | 97.70% | -0.90 | 0.080302 | 13,820 | 1,728 | 1.864× | 25 | 7.840× | 3.474× | 19,320 | 1.142 | 3.243 |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 8 | 968 | 1,000 | 96.80% | -1.80 | 0.081198 | 11,772 | 1,472 | 2.188× | 196 | 1.000× | 2.667× | 5,456 | 1.040 | 1.731 |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 6 | 968 | 1,000 | 96.80% | -1.80 | 0.081540 | 11,772 | 1,472 | 2.188× | 147 | 1.333× | 2.856× | 5,456 | 1.040 | 1.949 |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 4 | 968 | 1,000 | 96.80% | -1.80 | 0.079792 | 11,772 | 1,472 | 2.188× | 98 | 2.000× | 3.075× | 5,456 | 1.040 | 2.287 |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 3 | 971 | 1,000 | 97.10% | -1.50 | 0.085973 | 11,772 | 1,472 | 2.188× | 74 | 2.649× | 3.197× | 5,456 | 1.040 | 2.544 |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 2 | 970 | 1,000 | 97.00% | -1.60 | 0.085513 | 11,772 | 1,472 | 2.188× | 49 | 4.000× | 3.330× | 5,456 | 1.040 | 2.959 |
| INT3-Sym-PG-kernel[25,25,24] | 3 | group | sym | kernel | 1 | 970 | 1,000 | 97.00% | -1.60 | 0.086748 | 11,772 | 1,472 | 2.188× | 25 | 7.840× | 3.474× | 5,456 | 1.040 | 3.756 |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 8 | 981 | 1,000 | 98.10% | -0.50 | 0.081433 | 10,748 | 1,344 | 2.397× | 196 | 1.000× | 2.667× | 3,880 | 1.028 | 1.804 |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 6 | 980 | 1,000 | 98.00% | -0.60 | 0.095642 | 10,748 | 1,344 | 2.397× | 147 | 1.333× | 2.856× | 3,880 | 1.028 | 2.032 |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 4 | 982 | 1,000 | 98.20% | -0.40 | 0.097973 | 10,748 | 1,344 | 2.397× | 98 | 2.000× | 3.075× | 3,880 | 1.028 | 2.384 |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 3 | 980 | 1,000 | 98.00% | -0.60 | 0.079731 | 10,748 | 1,344 | 2.397× | 74 | 2.649× | 3.197× | 3,880 | 1.028 | 2.652 |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 2 | 979 | 1,000 | 97.90% | -0.70 | 0.076959 | 10,748 | 1,344 | 2.397× | 49 | 4.000× | 3.330× | 3,880 | 1.028 | 3.084 |
| INT3-Sym-PG-coarse[25,50,48] | 3 | group | sym | coarse | 1 | 976 | 1,000 | 97.60% | -1.00 | 0.080291 | 10,748 | 1,344 | 2.397× | 25 | 7.840× | 3.474× | 3,880 | 1.028 | 3.915 |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.077997 | 15,900 | 1,988 | 1.620× | 196 | 1.000× | 2.667× | 19,320 | 1.142 | 1.427 |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.077890 | 15,900 | 1,988 | 1.620× | 147 | 1.333× | 2.856× | 19,320 | 1.142 | 1.606 |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.080163 | 15,900 | 1,988 | 1.620× | 98 | 2.000× | 3.075× | 19,320 | 1.142 | 1.885 |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.079377 | 15,900 | 1,988 | 1.620× | 74 | 2.649× | 3.197× | 19,320 | 1.142 | 2.097 |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 2 | 986 | 1,000 | 98.60% | +0.00 | 0.078766 | 15,900 | 1,988 | 1.620× | 49 | 4.000× | 3.330× | 19,320 | 1.142 | 2.438 |
| INT3-Asym-PG-fine[5,10,16] | 3 | group | asym | fine | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.084513 | 15,900 | 1,988 | 1.620× | 25 | 7.840× | 3.474× | 19,320 | 1.142 | 3.095 |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.078908 | 12,828 | 1,604 | 2.008× | 196 | 1.000× | 2.667× | 5,456 | 1.040 | 1.682 |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.095409 | 12,828 | 1,604 | 2.008× | 147 | 1.333× | 2.856× | 5,456 | 1.040 | 1.894 |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.098529 | 12,828 | 1,604 | 2.008× | 98 | 2.000× | 3.075× | 5,456 | 1.040 | 2.222 |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.094080 | 12,828 | 1,604 | 2.008× | 74 | 2.649× | 3.197× | 5,456 | 1.040 | 2.473 |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 2 | 985 | 1,000 | 98.50% | -0.10 | 0.083805 | 12,828 | 1,604 | 2.008× | 49 | 4.000× | 3.330× | 5,456 | 1.040 | 2.875 |
| INT3-Asym-PG-kernel[25,25,24] | 3 | group | asym | kernel | 1 | 979 | 1,000 | 97.90% | -0.70 | 0.086639 | 12,828 | 1,604 | 2.008× | 25 | 7.840× | 3.474× | 5,456 | 1.040 | 3.650 |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 8 | 982 | 1,000 | 98.20% | -0.40 | 0.078314 | 11,292 | 1,412 | 2.281× | 196 | 1.000× | 2.667× | 3,880 | 1.028 | 1.775 |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 6 | 982 | 1,000 | 98.20% | -0.40 | 0.090836 | 11,292 | 1,412 | 2.281× | 147 | 1.333× | 2.856× | 3,880 | 1.028 | 1.999 |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.079501 | 11,292 | 1,412 | 2.281× | 98 | 2.000× | 3.075× | 3,880 | 1.028 | 2.345 |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 3 | 980 | 1,000 | 98.00% | -0.60 | 0.077717 | 11,292 | 1,412 | 2.281× | 74 | 2.649× | 3.197× | 3,880 | 1.028 | 2.609 |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.076505 | 11,292 | 1,412 | 2.281× | 49 | 4.000× | 3.330× | 3,880 | 1.028 | 3.034 |
| INT3-Asym-PG-coarse[25,50,48] | 3 | group | asym | coarse | 1 | 981 | 1,000 | 98.10% | -0.50 | 0.077262 | 11,292 | 1,412 | 2.281× | 25 | 7.840× | 3.474× | 3,880 | 1.028 | 3.851 |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.079243 | 17,040 | 2,130 | 1.512× | 196 | 1.000× | 2.000× | 19,320 | 1.142 | 1.267 |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.083575 | 17,040 | 2,130 | 1.512× | 147 | 1.333× | 2.142× | 19,320 | 1.142 | 1.426 |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 4 | 988 | 1,000 | 98.80% | +0.20 | 0.110864 | 17,040 | 2,130 | 1.512× | 98 | 2.000× | 2.306× | 19,320 | 1.142 | 1.673 |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.089634 | 17,040 | 2,130 | 1.512× | 74 | 2.649× | 2.398× | 19,320 | 1.142 | 1.862 |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 2 | 987 | 1,000 | 98.70% | +0.10 | 0.081943 | 17,040 | 2,130 | 1.512× | 49 | 4.000× | 2.497× | 19,320 | 1.142 | 2.165 |
| INT4-Sym-PG-fine[5,10,16] | 4 | group | sym | fine | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.087383 | 17,040 | 2,130 | 1.512× | 25 | 7.840× | 2.605× | 19,320 | 1.142 | 2.748 |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 8 | 990 | 1,000 | 99.00% | +0.40 | 0.083242 | 14,992 | 1,874 | 1.718× | 196 | 1.000× | 2.000× | 5,456 | 1.040 | 1.451 |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 6 | 990 | 1,000 | 99.00% | +0.40 | 0.085993 | 14,992 | 1,874 | 1.718× | 147 | 1.333× | 2.142× | 5,456 | 1.040 | 1.634 |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 4 | 990 | 1,000 | 99.00% | +0.40 | 0.086283 | 14,992 | 1,874 | 1.718× | 98 | 2.000× | 2.306× | 5,456 | 1.040 | 1.917 |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 3 | 989 | 1,000 | 98.90% | +0.30 | 0.086033 | 14,992 | 1,874 | 1.718× | 74 | 2.649× | 2.398× | 5,456 | 1.040 | 2.133 |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 2 | 989 | 1,000 | 98.90% | +0.30 | 0.081797 | 14,992 | 1,874 | 1.718× | 49 | 4.000× | 2.497× | 5,456 | 1.040 | 2.480 |
| INT4-Sym-PG-kernel[25,25,24] | 4 | group | sym | kernel | 1 | 982 | 1,000 | 98.20% | -0.40 | 0.082211 | 14,992 | 1,874 | 1.718× | 25 | 7.840× | 2.605× | 5,456 | 1.040 | 3.148 |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 8 | 983 | 1,000 | 98.30% | -0.30 | 0.079381 | 13,968 | 1,746 | 1.844× | 196 | 1.000× | 2.000× | 3,880 | 1.028 | 1.502 |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.097234 | 13,968 | 1,746 | 1.844× | 147 | 1.333× | 2.142× | 3,880 | 1.028 | 1.692 |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.089286 | 13,968 | 1,746 | 1.844× | 98 | 2.000× | 2.306× | 3,880 | 1.028 | 1.985 |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 3 | 981 | 1,000 | 98.10% | -0.50 | 0.093095 | 13,968 | 1,746 | 1.844× | 74 | 2.649× | 2.398× | 3,880 | 1.028 | 2.208 |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 2 | 981 | 1,000 | 98.10% | -0.50 | 0.083581 | 13,968 | 1,746 | 1.844× | 49 | 4.000× | 2.497× | 3,880 | 1.028 | 2.568 |
| INT4-Sym-PG-coarse[25,50,48] | 4 | group | sym | coarse | 1 | 967 | 1,000 | 96.70% | -1.90 | 0.079404 | 13,968 | 1,746 | 1.844× | 25 | 7.840× | 2.605× | 3,880 | 1.028 | 3.259 |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 8 | 978 | 1,000 | 97.80% | -0.80 | 0.082237 | 19,120 | 2,390 | 1.347× | 196 | 1.000× | 2.000× | 19,320 | 1.142 | 1.219 |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 6 | 979 | 1,000 | 97.90% | -0.70 | 0.079180 | 19,120 | 2,390 | 1.347× | 147 | 1.333× | 2.142× | 19,320 | 1.142 | 1.373 |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 4 | 978 | 1,000 | 97.80% | -0.80 | 0.079984 | 19,120 | 2,390 | 1.347× | 98 | 2.000× | 2.306× | 19,320 | 1.142 | 1.610 |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 3 | 979 | 1,000 | 97.90% | -0.70 | 0.081765 | 19,120 | 2,390 | 1.347× | 74 | 2.649× | 2.398× | 19,320 | 1.142 | 1.791 |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 2 | 981 | 1,000 | 98.10% | -0.50 | 0.079442 | 19,120 | 2,390 | 1.347× | 49 | 4.000× | 2.497× | 19,320 | 1.142 | 2.083 |
| INT4-Asym-PG-fine[5,10,16] | 4 | group | asym | fine | 1 | 978 | 1,000 | 97.80% | -0.80 | 0.081234 | 19,120 | 2,390 | 1.347× | 25 | 7.840× | 2.605× | 19,320 | 1.142 | 2.644 |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.083555 | 16,048 | 2,006 | 1.605× | 196 | 1.000× | 2.000× | 5,456 | 1.040 | 1.418 |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.096810 | 16,048 | 2,006 | 1.605× | 147 | 1.333× | 2.142× | 5,456 | 1.040 | 1.597 |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 4 | 982 | 1,000 | 98.20% | -0.40 | 0.093351 | 16,048 | 2,006 | 1.605× | 98 | 2.000× | 2.306× | 5,456 | 1.040 | 1.874 |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 3 | 981 | 1,000 | 98.10% | -0.50 | 0.089984 | 16,048 | 2,006 | 1.605× | 74 | 2.649× | 2.398× | 5,456 | 1.040 | 2.085 |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.090117 | 16,048 | 2,006 | 1.605× | 49 | 4.000× | 2.497× | 5,456 | 1.040 | 2.425 |
| INT4-Asym-PG-kernel[25,25,24] | 4 | group | asym | kernel | 1 | 975 | 1,000 | 97.50% | -1.10 | 0.078779 | 16,048 | 2,006 | 1.605× | 25 | 7.840× | 2.605× | 5,456 | 1.040 | 3.077 |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 8 | 983 | 1,000 | 98.30% | -0.30 | 0.081128 | 14,512 | 1,814 | 1.775× | 196 | 1.000× | 2.000× | 3,880 | 1.028 | 1.483 |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 6 | 983 | 1,000 | 98.30% | -0.30 | 0.077936 | 14,512 | 1,814 | 1.775× | 147 | 1.333× | 2.142× | 3,880 | 1.028 | 1.670 |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.082483 | 14,512 | 1,814 | 1.775× | 98 | 2.000× | 2.306× | 3,880 | 1.028 | 1.960 |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 3 | 981 | 1,000 | 98.10% | -0.50 | 0.086492 | 14,512 | 1,814 | 1.775× | 74 | 2.649× | 2.398× | 3,880 | 1.028 | 2.180 |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.084169 | 14,512 | 1,814 | 1.775× | 49 | 4.000× | 2.497× | 3,880 | 1.028 | 2.535 |
| INT4-Asym-PG-coarse[25,50,48] | 4 | group | asym | coarse | 1 | 968 | 1,000 | 96.80% | -1.80 | 0.082594 | 14,512 | 1,814 | 1.775× | 25 | 7.840× | 2.605× | 3,880 | 1.028 | 3.218 |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.088463 | 23,480 | 2,935 | 1.097× | 196 | 1.000× | 1.333× | 19,320 | 1.142 | 0.994 |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.093506 | 23,480 | 2,935 | 1.097× | 147 | 1.333× | 1.428× | 19,320 | 1.142 | 1.120 |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.091868 | 23,480 | 2,935 | 1.097× | 98 | 2.000× | 1.537× | 19,320 | 1.142 | 1.314 |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.081421 | 23,480 | 2,935 | 1.097× | 74 | 2.649× | 1.599× | 19,320 | 1.142 | 1.461 |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.085964 | 23,480 | 2,935 | 1.097× | 49 | 4.000× | 1.665× | 19,320 | 1.142 | 1.700 |
| INT6-Sym-PG-fine[5,10,16] | 6 | group | sym | fine | 1 | 982 | 1,000 | 98.20% | -0.40 | 0.100366 | 23,480 | 2,935 | 1.097× | 25 | 7.840× | 1.737× | 19,320 | 1.142 | 2.157 |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.086767 | 21,432 | 2,679 | 1.202× | 196 | 1.000× | 1.333× | 5,456 | 1.040 | 1.125 |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.078582 | 21,432 | 2,679 | 1.202× | 147 | 1.333× | 1.428× | 5,456 | 1.040 | 1.267 |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.079516 | 21,432 | 2,679 | 1.202× | 98 | 2.000× | 1.537× | 5,456 | 1.040 | 1.487 |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 3 | 982 | 1,000 | 98.20% | -0.40 | 0.078766 | 21,432 | 2,679 | 1.202× | 74 | 2.649× | 1.599× | 5,456 | 1.040 | 1.654 |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.080931 | 21,432 | 2,679 | 1.202× | 49 | 4.000× | 1.665× | 5,456 | 1.040 | 1.923 |
| INT6-Sym-PG-kernel[25,25,24] | 6 | group | sym | kernel | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.087747 | 21,432 | 2,679 | 1.202× | 25 | 7.840× | 1.737× | 5,456 | 1.040 | 2.441 |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.109083 | 20,408 | 2,551 | 1.262× | 196 | 1.000× | 1.333× | 3,880 | 1.028 | 1.157 |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.091789 | 20,408 | 2,551 | 1.262× | 147 | 1.333× | 1.428× | 3,880 | 1.028 | 1.302 |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.089727 | 20,408 | 2,551 | 1.262× | 98 | 2.000× | 1.537× | 3,880 | 1.028 | 1.528 |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 3 | 982 | 1,000 | 98.20% | -0.40 | 0.081394 | 20,408 | 2,551 | 1.262× | 74 | 2.649× | 1.599× | 3,880 | 1.028 | 1.700 |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.080702 | 20,408 | 2,551 | 1.262× | 49 | 4.000× | 1.665× | 3,880 | 1.028 | 1.977 |
| INT6-Sym-PG-coarse[25,50,48] | 6 | group | sym | coarse | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.086770 | 20,408 | 2,551 | 1.262× | 25 | 7.840× | 1.737× | 3,880 | 1.028 | 2.509 |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.095626 | 25,560 | 3,195 | 1.008× | 196 | 1.000× | 1.333× | 19,320 | 1.142 | 0.967 |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.085374 | 25,560 | 3,195 | 1.008× | 147 | 1.333× | 1.428× | 19,320 | 1.142 | 1.088 |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 4 | 987 | 1,000 | 98.70% | +0.10 | 0.090105 | 25,560 | 3,195 | 1.008× | 98 | 2.000× | 1.537× | 19,320 | 1.142 | 1.277 |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 3 | 986 | 1,000 | 98.60% | +0.00 | 0.083971 | 25,560 | 3,195 | 1.008× | 74 | 2.649× | 1.599× | 19,320 | 1.142 | 1.421 |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 2 | 984 | 1,000 | 98.40% | -0.20 | 0.082957 | 25,560 | 3,195 | 1.008× | 49 | 4.000× | 1.665× | 19,320 | 1.142 | 1.652 |
| INT6-Asym-PG-fine[5,10,16] | 6 | group | asym | fine | 1 | 985 | 1,000 | 98.50% | -0.10 | 0.086302 | 25,560 | 3,195 | 1.008× | 25 | 7.840× | 1.737× | 19,320 | 1.142 | 2.097 |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.099834 | 22,488 | 2,811 | 1.145× | 196 | 1.000× | 1.333× | 5,456 | 1.040 | 1.107 |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.110043 | 22,488 | 2,811 | 1.145× | 147 | 1.333× | 1.428× | 5,456 | 1.040 | 1.247 |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.111965 | 22,488 | 2,811 | 1.145× | 98 | 2.000× | 1.537× | 5,456 | 1.040 | 1.463 |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.100687 | 22,488 | 2,811 | 1.145× | 74 | 2.649× | 1.599× | 5,456 | 1.040 | 1.628 |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.081705 | 22,488 | 2,811 | 1.145× | 49 | 4.000× | 1.665× | 5,456 | 1.040 | 1.893 |
| INT6-Asym-PG-kernel[25,25,24] | 6 | group | asym | kernel | 1 | 978 | 1,000 | 97.80% | -0.80 | 0.079471 | 22,488 | 2,811 | 1.145× | 25 | 7.840× | 1.737× | 5,456 | 1.040 | 2.402 |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.079643 | 20,952 | 2,619 | 1.229× | 196 | 1.000× | 1.333× | 3,880 | 1.028 | 1.146 |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.087694 | 20,952 | 2,619 | 1.229× | 147 | 1.333× | 1.428× | 3,880 | 1.028 | 1.291 |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.078770 | 20,952 | 2,619 | 1.229× | 98 | 2.000× | 1.537× | 3,880 | 1.028 | 1.515 |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 3 | 986 | 1,000 | 98.60% | +0.00 | 0.082154 | 20,952 | 2,619 | 1.229× | 74 | 2.649× | 1.599× | 3,880 | 1.028 | 1.685 |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.095280 | 20,952 | 2,619 | 1.229× | 49 | 4.000× | 1.665× | 3,880 | 1.028 | 1.960 |
| INT6-Asym-PG-coarse[25,50,48] | 6 | group | asym | coarse | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.090008 | 20,952 | 2,619 | 1.229× | 25 | 7.840× | 1.737× | 3,880 | 1.028 | 2.487 |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.084338 | 29,920 | 3,740 | 0.861× | 196 | 1.000× | 1.000× | 19,320 | 1.142 | 0.833 |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.088249 | 29,920 | 3,740 | 0.861× | 147 | 1.333× | 1.071× | 19,320 | 1.142 | 0.938 |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.098885 | 29,920 | 3,740 | 0.861× | 98 | 2.000× | 1.153× | 19,320 | 1.142 | 1.101 |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.085771 | 29,920 | 3,740 | 0.861× | 74 | 2.649× | 1.199× | 19,320 | 1.142 | 1.225 |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.083931 | 29,920 | 3,740 | 0.861× | 49 | 4.000× | 1.249× | 19,320 | 1.142 | 1.424 |
| INT8-Sym-PG-fine[5,10,16] | 8 | group | sym | fine | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.079821 | 29,920 | 3,740 | 0.861× | 25 | 7.840× | 1.303× | 19,320 | 1.142 | 1.808 |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.081355 | 27,872 | 3,484 | 0.924× | 196 | 1.000× | 1.000× | 5,456 | 1.040 | 0.937 |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.090077 | 27,872 | 3,484 | 0.924× | 147 | 1.333× | 1.071× | 5,456 | 1.040 | 1.055 |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.083776 | 27,872 | 3,484 | 0.924× | 98 | 2.000× | 1.153× | 5,456 | 1.040 | 1.237 |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.090799 | 27,872 | 3,484 | 0.924× | 74 | 2.649× | 1.199× | 5,456 | 1.040 | 1.377 |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.095523 | 27,872 | 3,484 | 0.924× | 49 | 4.000× | 1.249× | 5,456 | 1.040 | 1.601 |
| INT8-Sym-PG-kernel[25,25,24] | 8 | group | sym | kernel | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.095555 | 27,872 | 3,484 | 0.924× | 25 | 7.840× | 1.303× | 5,456 | 1.040 | 2.032 |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.103637 | 26,848 | 3,356 | 0.959× | 196 | 1.000× | 1.000× | 3,880 | 1.028 | 0.959 |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.096988 | 26,848 | 3,356 | 0.959× | 147 | 1.333× | 1.071× | 3,880 | 1.028 | 1.080 |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.097100 | 26,848 | 3,356 | 0.959× | 98 | 2.000× | 1.153× | 3,880 | 1.028 | 1.267 |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.090054 | 26,848 | 3,356 | 0.959× | 74 | 2.649× | 1.199× | 3,880 | 1.028 | 1.410 |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.088455 | 26,848 | 3,356 | 0.959× | 49 | 4.000× | 1.249× | 3,880 | 1.028 | 1.639 |
| INT8-Sym-PG-coarse[25,50,48] | 8 | group | sym | coarse | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.081084 | 26,848 | 3,356 | 0.959× | 25 | 7.840× | 1.303× | 3,880 | 1.028 | 2.081 |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.082862 | 32,000 | 4,000 | 0.805× | 196 | 1.000× | 1.000× | 19,320 | 1.142 | 0.815 |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.080803 | 32,000 | 4,000 | 0.805× | 147 | 1.333× | 1.071× | 19,320 | 1.142 | 0.918 |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.094299 | 32,000 | 4,000 | 0.805× | 98 | 2.000× | 1.153× | 19,320 | 1.142 | 1.076 |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.102856 | 32,000 | 4,000 | 0.805× | 74 | 2.649× | 1.199× | 19,320 | 1.142 | 1.198 |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.089903 | 32,000 | 4,000 | 0.805× | 49 | 4.000× | 1.249× | 19,320 | 1.142 | 1.393 |
| INT8-Asym-PG-fine[5,10,16] | 8 | group | asym | fine | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.083640 | 32,000 | 4,000 | 0.805× | 25 | 7.840× | 1.303× | 19,320 | 1.142 | 1.768 |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.083345 | 28,928 | 3,616 | 0.890× | 196 | 1.000× | 1.000× | 5,456 | 1.040 | 0.925 |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.092215 | 28,928 | 3,616 | 0.890× | 147 | 1.333× | 1.071× | 5,456 | 1.040 | 1.042 |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.088047 | 28,928 | 3,616 | 0.890× | 98 | 2.000× | 1.153× | 5,456 | 1.040 | 1.222 |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.086605 | 28,928 | 3,616 | 0.890× | 74 | 2.649× | 1.199× | 5,456 | 1.040 | 1.360 |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.082669 | 28,928 | 3,616 | 0.890× | 49 | 4.000× | 1.249× | 5,456 | 1.040 | 1.581 |
| INT8-Asym-PG-kernel[25,25,24] | 8 | group | asym | kernel | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.081639 | 28,928 | 3,616 | 0.890× | 25 | 7.840× | 1.303× | 5,456 | 1.040 | 2.007 |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.097865 | 27,392 | 3,424 | 0.940× | 196 | 1.000× | 1.000× | 3,880 | 1.028 | 0.953 |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.093152 | 27,392 | 3,424 | 0.940× | 147 | 1.333× | 1.071× | 3,880 | 1.028 | 1.073 |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 4 | 985 | 1,000 | 98.50% | -0.10 | 0.102591 | 27,392 | 3,424 | 0.940× | 98 | 2.000× | 1.153× | 3,880 | 1.028 | 1.259 |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.087538 | 27,392 | 3,424 | 0.940× | 74 | 2.649× | 1.199× | 3,880 | 1.028 | 1.400 |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.083367 | 27,392 | 3,424 | 0.940× | 49 | 4.000× | 1.249× | 3,880 | 1.028 | 1.628 |
| INT8-Asym-PG-coarse[25,50,48] | 8 | group | asym | coarse | 1 | 984 | 1,000 | 98.40% | -0.20 | 0.102317 | 27,392 | 3,424 | 0.940× | 25 | 7.840× | 1.303× | 3,880 | 1.028 | 2.067 |
| FP3-PT | 3 | tensor | fp | - | 8 | 978 | 1,000 | 97.80% | -0.80 | 0.106030 | 9,708 | 1,214 | 2.653× | 196 | 1.000× | 2.667× | 0 | 1.000 | 1.920 |
| FP3-PT | 3 | tensor | fp | - | 6 | 978 | 1,000 | 97.80% | -0.80 | 0.099057 | 9,708 | 1,214 | 2.653× | 147 | 1.333× | 2.856× | 0 | 1.000 | 2.162 |
| FP3-PT | 3 | tensor | fp | - | 4 | 978 | 1,000 | 97.80% | -0.80 | 0.096752 | 9,708 | 1,214 | 2.653× | 98 | 2.000× | 3.075× | 0 | 1.000 | 2.536 |
| FP3-PT | 3 | tensor | fp | - | 3 | 977 | 1,000 | 97.70% | -0.90 | 0.082651 | 9,708 | 1,214 | 2.653× | 74 | 2.649× | 3.197× | 0 | 1.000 | 2.822 |
| FP3-PT | 3 | tensor | fp | - | 2 | 975 | 1,000 | 97.50% | -1.10 | 0.082458 | 9,708 | 1,214 | 2.653× | 49 | 4.000× | 3.330× | 0 | 1.000 | 3.282 |
| FP3-PT | 3 | tensor | fp | - | 1 | 974 | 1,000 | 97.40% | -1.20 | 0.083816 | 9,708 | 1,214 | 2.653× | 25 | 7.840× | 3.474× | 0 | 1.000 | 4.165 |
| FP3-PC | 3 | channel | fp | - | 8 | 942 | 1,000 | 94.20% | -4.40 | 0.093574 | 10,076 | 1,260 | 2.557× | 196 | 1.000× | 2.667× | 0 | 1.000 | 1.896 |
| FP3-PC | 3 | channel | fp | - | 6 | 941 | 1,000 | 94.10% | -4.50 | 0.104986 | 10,076 | 1,260 | 2.557× | 147 | 1.333× | 2.856× | 0 | 1.000 | 2.135 |
| FP3-PC | 3 | channel | fp | - | 4 | 945 | 1,000 | 94.50% | -4.10 | 0.084814 | 10,076 | 1,260 | 2.557× | 98 | 2.000× | 3.075× | 0 | 1.000 | 2.505 |
| FP3-PC | 3 | channel | fp | - | 3 | 943 | 1,000 | 94.30% | -4.30 | 0.085887 | 10,076 | 1,260 | 2.557× | 74 | 2.649× | 3.197× | 0 | 1.000 | 2.787 |
| FP3-PC | 3 | channel | fp | - | 2 | 938 | 1,000 | 93.80% | -4.80 | 0.087645 | 10,076 | 1,260 | 2.557× | 49 | 4.000× | 3.330× | 0 | 1.000 | 3.241 |
| FP3-PC | 3 | channel | fp | - | 1 | 916 | 1,000 | 91.60% | -7.00 | 0.087088 | 10,076 | 1,260 | 2.557× | 25 | 7.840× | 3.474× | 0 | 1.000 | 4.114 |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 8 | 976 | 1,000 | 97.60% | -1.00 | 0.089421 | 13,820 | 1,728 | 1.864× | 196 | 1.000× | 2.667× | 19,320 | 1.142 | 1.495 |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 6 | 976 | 1,000 | 97.60% | -1.00 | 0.085052 | 13,820 | 1,728 | 1.864× | 147 | 1.333× | 2.856× | 19,320 | 1.142 | 1.683 |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 4 | 978 | 1,000 | 97.80% | -0.80 | 0.083505 | 13,820 | 1,728 | 1.864× | 98 | 2.000× | 3.075× | 19,320 | 1.142 | 1.975 |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 3 | 977 | 1,000 | 97.70% | -0.90 | 0.082763 | 13,820 | 1,728 | 1.864× | 74 | 2.649× | 3.197× | 19,320 | 1.142 | 2.197 |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 2 | 972 | 1,000 | 97.20% | -1.40 | 0.085345 | 13,820 | 1,728 | 1.864× | 49 | 4.000× | 3.330× | 19,320 | 1.142 | 2.555 |
| FP3-PG-fine[5,10,16] | 3 | group | fp | fine | 1 | 959 | 1,000 | 95.90% | -2.70 | 0.085047 | 13,820 | 1,728 | 1.864× | 25 | 7.840× | 3.474× | 19,320 | 1.142 | 3.243 |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 8 | 980 | 1,000 | 98.00% | -0.60 | 0.098555 | 11,772 | 1,472 | 2.188× | 196 | 1.000× | 2.667× | 5,456 | 1.040 | 1.731 |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 6 | 980 | 1,000 | 98.00% | -0.60 | 0.094096 | 11,772 | 1,472 | 2.188× | 147 | 1.333× | 2.856× | 5,456 | 1.040 | 1.949 |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 4 | 979 | 1,000 | 97.90% | -0.70 | 0.093853 | 11,772 | 1,472 | 2.188× | 98 | 2.000× | 3.075× | 5,456 | 1.040 | 2.287 |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 3 | 980 | 1,000 | 98.00% | -0.60 | 0.083764 | 11,772 | 1,472 | 2.188× | 74 | 2.649× | 3.197× | 5,456 | 1.040 | 2.544 |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 2 | 979 | 1,000 | 97.90% | -0.70 | 0.081915 | 11,772 | 1,472 | 2.188× | 49 | 4.000× | 3.330× | 5,456 | 1.040 | 2.959 |
| FP3-PG-kernel[25,25,24] | 3 | group | fp | kernel | 1 | 963 | 1,000 | 96.30% | -2.30 | 0.092074 | 11,772 | 1,472 | 2.188× | 25 | 7.840× | 3.474× | 5,456 | 1.040 | 3.756 |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 8 | 968 | 1,000 | 96.80% | -1.80 | 0.095932 | 10,748 | 1,344 | 2.397× | 196 | 1.000× | 2.667× | 3,880 | 1.028 | 1.804 |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 6 | 968 | 1,000 | 96.80% | -1.80 | 0.082762 | 10,748 | 1,344 | 2.397× | 147 | 1.333× | 2.856× | 3,880 | 1.028 | 2.032 |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 4 | 968 | 1,000 | 96.80% | -1.80 | 0.083051 | 10,748 | 1,344 | 2.397× | 98 | 2.000× | 3.075× | 3,880 | 1.028 | 2.384 |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 3 | 967 | 1,000 | 96.70% | -1.90 | 0.083614 | 10,748 | 1,344 | 2.397× | 74 | 2.649× | 3.197× | 3,880 | 1.028 | 2.652 |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 2 | 967 | 1,000 | 96.70% | -1.90 | 0.083914 | 10,748 | 1,344 | 2.397× | 49 | 4.000× | 3.330× | 3,880 | 1.028 | 3.084 |
| FP3-PG-coarse[25,50,48] | 3 | group | fp | coarse | 1 | 954 | 1,000 | 95.40% | -3.20 | 0.097196 | 10,748 | 1,344 | 2.397× | 25 | 7.840× | 3.474× | 3,880 | 1.028 | 3.915 |
| FP4-PT | 4 | tensor | fp | - | 8 | 979 | 1,000 | 97.90% | -0.70 | 0.089887 | 12,928 | 1,616 | 1.993× | 196 | 1.000× | 2.000× | 0 | 1.000 | 1.585 |
| FP4-PT | 4 | tensor | fp | - | 6 | 979 | 1,000 | 97.90% | -0.70 | 0.082885 | 12,928 | 1,616 | 1.993× | 147 | 1.333× | 2.142× | 0 | 1.000 | 1.785 |
| FP4-PT | 4 | tensor | fp | - | 4 | 979 | 1,000 | 97.90% | -0.70 | 0.090132 | 12,928 | 1,616 | 1.993× | 98 | 2.000× | 2.306× | 0 | 1.000 | 2.095 |
| FP4-PT | 4 | tensor | fp | - | 3 | 980 | 1,000 | 98.00% | -0.60 | 0.083427 | 12,928 | 1,616 | 1.993× | 74 | 2.649× | 2.398× | 0 | 1.000 | 2.330 |
| FP4-PT | 4 | tensor | fp | - | 2 | 975 | 1,000 | 97.50% | -1.10 | 0.081025 | 12,928 | 1,616 | 1.993× | 49 | 4.000× | 2.497× | 0 | 1.000 | 2.710 |
| FP4-PT | 4 | tensor | fp | - | 1 | 969 | 1,000 | 96.90% | -1.70 | 0.089825 | 12,928 | 1,616 | 1.993× | 25 | 7.840× | 2.605× | 0 | 1.000 | 3.440 |
| FP4-PC | 4 | channel | fp | - | 8 | 966 | 1,000 | 96.60% | -2.00 | 0.085808 | 13,296 | 1,662 | 1.937× | 196 | 1.000× | 2.000× | 0 | 1.000 | 1.571 |
| FP4-PC | 4 | channel | fp | - | 6 | 967 | 1,000 | 96.70% | -1.90 | 0.082692 | 13,296 | 1,662 | 1.937× | 147 | 1.333× | 2.142× | 0 | 1.000 | 1.769 |
| FP4-PC | 4 | channel | fp | - | 4 | 969 | 1,000 | 96.90% | -1.70 | 0.085475 | 13,296 | 1,662 | 1.937× | 98 | 2.000× | 2.306× | 0 | 1.000 | 2.075 |
| FP4-PC | 4 | channel | fp | - | 3 | 965 | 1,000 | 96.50% | -2.10 | 0.083043 | 13,296 | 1,662 | 1.937× | 74 | 2.649× | 2.398× | 0 | 1.000 | 2.309 |
| FP4-PC | 4 | channel | fp | - | 2 | 963 | 1,000 | 96.30% | -2.30 | 0.089214 | 13,296 | 1,662 | 1.937× | 49 | 4.000× | 2.497× | 0 | 1.000 | 2.685 |
| FP4-PC | 4 | channel | fp | - | 1 | 948 | 1,000 | 94.80% | -3.80 | 0.092368 | 13,296 | 1,662 | 1.937× | 25 | 7.840× | 2.605× | 0 | 1.000 | 3.408 |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.089385 | 17,040 | 2,130 | 1.512× | 196 | 1.000× | 2.000× | 19,320 | 1.142 | 1.267 |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.083645 | 17,040 | 2,130 | 1.512× | 147 | 1.333× | 2.142× | 19,320 | 1.142 | 1.426 |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.082868 | 17,040 | 2,130 | 1.512× | 98 | 2.000× | 2.306× | 19,320 | 1.142 | 1.673 |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.084888 | 17,040 | 2,130 | 1.512× | 74 | 2.649× | 2.398× | 19,320 | 1.142 | 1.862 |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 2 | 985 | 1,000 | 98.50% | -0.10 | 0.083804 | 17,040 | 2,130 | 1.512× | 49 | 4.000× | 2.497× | 19,320 | 1.142 | 2.165 |
| FP4-PG-fine[5,10,16] | 4 | group | fp | fine | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.094252 | 17,040 | 2,130 | 1.512× | 25 | 7.840× | 2.605× | 19,320 | 1.142 | 2.748 |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 8 | 980 | 1,000 | 98.00% | -0.60 | 0.103827 | 14,992 | 1,874 | 1.718× | 196 | 1.000× | 2.000× | 5,456 | 1.040 | 1.451 |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 6 | 980 | 1,000 | 98.00% | -0.60 | 0.086189 | 14,992 | 1,874 | 1.718× | 147 | 1.333× | 2.142× | 5,456 | 1.040 | 1.634 |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 4 | 976 | 1,000 | 97.60% | -1.00 | 0.085866 | 14,992 | 1,874 | 1.718× | 98 | 2.000× | 2.306× | 5,456 | 1.040 | 1.917 |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 3 | 977 | 1,000 | 97.70% | -0.90 | 0.085957 | 14,992 | 1,874 | 1.718× | 74 | 2.649× | 2.398× | 5,456 | 1.040 | 2.133 |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 2 | 977 | 1,000 | 97.70% | -0.90 | 0.103230 | 14,992 | 1,874 | 1.718× | 49 | 4.000× | 2.497× | 5,456 | 1.040 | 2.480 |
| FP4-PG-kernel[25,25,24] | 4 | group | fp | kernel | 1 | 969 | 1,000 | 96.90% | -1.70 | 0.092170 | 14,992 | 1,874 | 1.718× | 25 | 7.840× | 2.605× | 5,456 | 1.040 | 3.148 |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 8 | 982 | 1,000 | 98.20% | -0.40 | 0.087532 | 13,968 | 1,746 | 1.844× | 196 | 1.000× | 2.000× | 3,880 | 1.028 | 1.502 |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 6 | 982 | 1,000 | 98.20% | -0.40 | 0.093359 | 13,968 | 1,746 | 1.844× | 147 | 1.333× | 2.142× | 3,880 | 1.028 | 1.692 |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.092545 | 13,968 | 1,746 | 1.844× | 98 | 2.000× | 2.306× | 3,880 | 1.028 | 1.985 |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 3 | 981 | 1,000 | 98.10% | -0.50 | 0.084234 | 13,968 | 1,746 | 1.844× | 74 | 2.649× | 2.398× | 3,880 | 1.028 | 2.208 |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 2 | 981 | 1,000 | 98.10% | -0.50 | 0.081521 | 13,968 | 1,746 | 1.844× | 49 | 4.000× | 2.497× | 3,880 | 1.028 | 2.568 |
| FP4-PG-coarse[25,50,48] | 4 | group | fp | coarse | 1 | 969 | 1,000 | 96.90% | -1.70 | 0.097441 | 13,968 | 1,746 | 1.844× | 25 | 7.840× | 2.605× | 3,880 | 1.028 | 3.259 |
| FP6-E2M3-PT | 6 | tensor | fp | - | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.086409 | 19,368 | 2,421 | 1.330× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.210 |
| FP6-E2M3-PT | 6 | tensor | fp | - | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.088237 | 19,368 | 2,421 | 1.330× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.363 |
| FP6-E2M3-PT | 6 | tensor | fp | - | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.092735 | 19,368 | 2,421 | 1.330× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.599 |
| FP6-E2M3-PT | 6 | tensor | fp | - | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.105705 | 19,368 | 2,421 | 1.330× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.779 |
| FP6-E2M3-PT | 6 | tensor | fp | - | 2 | 981 | 1,000 | 98.10% | -0.50 | 0.088921 | 19,368 | 2,421 | 1.330× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.069 |
| FP6-E2M3-PT | 6 | tensor | fp | - | 1 | 982 | 1,000 | 98.20% | -0.40 | 0.095618 | 19,368 | 2,421 | 1.330× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.626 |
| FP6-E2M3-PC | 6 | channel | fp | - | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.084532 | 19,736 | 2,467 | 1.305× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.203 |
| FP6-E2M3-PC | 6 | channel | fp | - | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.090398 | 19,736 | 2,467 | 1.305× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.355 |
| FP6-E2M3-PC | 6 | channel | fp | - | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.082746 | 19,736 | 2,467 | 1.305× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.589 |
| FP6-E2M3-PC | 6 | channel | fp | - | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.082491 | 19,736 | 2,467 | 1.305× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.768 |
| FP6-E2M3-PC | 6 | channel | fp | - | 2 | 984 | 1,000 | 98.40% | -0.20 | 0.091158 | 19,736 | 2,467 | 1.305× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.056 |
| FP6-E2M3-PC | 6 | channel | fp | - | 1 | 980 | 1,000 | 98.00% | -0.60 | 0.092707 | 19,736 | 2,467 | 1.305× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.610 |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.083472 | 23,480 | 2,935 | 1.097× | 196 | 1.000× | 1.333× | 19,320 | 1.142 | 0.994 |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.084847 | 23,480 | 2,935 | 1.097× | 147 | 1.333× | 1.428× | 19,320 | 1.142 | 1.120 |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.095750 | 23,480 | 2,935 | 1.097× | 98 | 2.000× | 1.537× | 19,320 | 1.142 | 1.314 |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 3 | 984 | 1,000 | 98.40% | -0.20 | 0.086243 | 23,480 | 2,935 | 1.097× | 74 | 2.649× | 1.599× | 19,320 | 1.142 | 1.461 |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.088000 | 23,480 | 2,935 | 1.097× | 49 | 4.000× | 1.665× | 19,320 | 1.142 | 1.700 |
| FP6-E2M3-PG-fine[5,10,16] | 6 | group | fp | fine | 1 | 982 | 1,000 | 98.20% | -0.40 | 0.088088 | 23,480 | 2,935 | 1.097× | 25 | 7.840× | 1.737× | 19,320 | 1.142 | 2.157 |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 8 | 984 | 1,000 | 98.40% | -0.20 | 0.082332 | 21,432 | 2,679 | 1.202× | 196 | 1.000× | 1.333× | 5,456 | 1.040 | 1.125 |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 6 | 984 | 1,000 | 98.40% | -0.20 | 0.092636 | 21,432 | 2,679 | 1.202× | 147 | 1.333× | 1.428× | 5,456 | 1.040 | 1.267 |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 4 | 983 | 1,000 | 98.30% | -0.30 | 0.083879 | 21,432 | 2,679 | 1.202× | 98 | 2.000× | 1.537× | 5,456 | 1.040 | 1.487 |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.084150 | 21,432 | 2,679 | 1.202× | 74 | 2.649× | 1.599× | 5,456 | 1.040 | 1.654 |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.098990 | 21,432 | 2,679 | 1.202× | 49 | 4.000× | 1.665× | 5,456 | 1.040 | 1.923 |
| FP6-E2M3-PG-kernel[25,25,24] | 6 | group | fp | kernel | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.084533 | 21,432 | 2,679 | 1.202× | 25 | 7.840× | 1.737× | 5,456 | 1.040 | 2.441 |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 8 | 988 | 1,000 | 98.80% | +0.20 | 0.086635 | 20,408 | 2,551 | 1.262× | 196 | 1.000× | 1.333× | 3,880 | 1.028 | 1.157 |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 6 | 988 | 1,000 | 98.80% | +0.20 | 0.099775 | 20,408 | 2,551 | 1.262× | 147 | 1.333× | 1.428× | 3,880 | 1.028 | 1.302 |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.108788 | 20,408 | 2,551 | 1.262× | 98 | 2.000× | 1.537× | 3,880 | 1.028 | 1.528 |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.090545 | 20,408 | 2,551 | 1.262× | 74 | 2.649× | 1.599× | 3,880 | 1.028 | 1.700 |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 2 | 985 | 1,000 | 98.50% | -0.10 | 0.089653 | 20,408 | 2,551 | 1.262× | 49 | 4.000× | 1.665× | 3,880 | 1.028 | 1.977 |
| FP6-E2M3-PG-coarse[25,50,48] | 6 | group | fp | coarse | 1 | 980 | 1,000 | 98.00% | -0.60 | 0.087593 | 20,408 | 2,551 | 1.262× | 25 | 7.840× | 1.737× | 3,880 | 1.028 | 2.509 |
| FP6-E3M2-PT | 6 | tensor | fp | - | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.090164 | 19,368 | 2,421 | 1.330× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.210 |
| FP6-E3M2-PT | 6 | tensor | fp | - | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.082980 | 19,368 | 2,421 | 1.330× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.363 |
| FP6-E3M2-PT | 6 | tensor | fp | - | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.085325 | 19,368 | 2,421 | 1.330× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.599 |
| FP6-E3M2-PT | 6 | tensor | fp | - | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.092732 | 19,368 | 2,421 | 1.330× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.779 |
| FP6-E3M2-PT | 6 | tensor | fp | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.094074 | 19,368 | 2,421 | 1.330× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.069 |
| FP6-E3M2-PT | 6 | tensor | fp | - | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.084293 | 19,368 | 2,421 | 1.330× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.626 |
| FP6-E3M2-PC | 6 | channel | fp | - | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.090628 | 19,736 | 2,467 | 1.305× | 196 | 1.000× | 1.333× | 0 | 1.000 | 1.203 |
| FP6-E3M2-PC | 6 | channel | fp | - | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.089656 | 19,736 | 2,467 | 1.305× | 147 | 1.333× | 1.428× | 0 | 1.000 | 1.355 |
| FP6-E3M2-PC | 6 | channel | fp | - | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.085036 | 19,736 | 2,467 | 1.305× | 98 | 2.000× | 1.537× | 0 | 1.000 | 1.589 |
| FP6-E3M2-PC | 6 | channel | fp | - | 3 | 983 | 1,000 | 98.30% | -0.30 | 0.085146 | 19,736 | 2,467 | 1.305× | 74 | 2.649× | 1.599× | 0 | 1.000 | 1.768 |
| FP6-E3M2-PC | 6 | channel | fp | - | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.095512 | 19,736 | 2,467 | 1.305× | 49 | 4.000× | 1.665× | 0 | 1.000 | 2.056 |
| FP6-E3M2-PC | 6 | channel | fp | - | 1 | 983 | 1,000 | 98.30% | -0.30 | 0.086019 | 19,736 | 2,467 | 1.305× | 25 | 7.840× | 1.737× | 0 | 1.000 | 2.610 |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 8 | 988 | 1,000 | 98.80% | +0.20 | 0.085467 | 23,480 | 2,935 | 1.097× | 196 | 1.000× | 1.333× | 19,320 | 1.142 | 0.994 |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.083649 | 23,480 | 2,935 | 1.097× | 147 | 1.333× | 1.428× | 19,320 | 1.142 | 1.120 |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 4 | 987 | 1,000 | 98.70% | +0.10 | 0.082699 | 23,480 | 2,935 | 1.097× | 98 | 2.000× | 1.537× | 19,320 | 1.142 | 1.314 |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.098537 | 23,480 | 2,935 | 1.097× | 74 | 2.649× | 1.599× | 19,320 | 1.142 | 1.461 |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.085481 | 23,480 | 2,935 | 1.097× | 49 | 4.000× | 1.665× | 19,320 | 1.142 | 1.700 |
| FP6-E3M2-PG-fine[5,10,16] | 6 | group | fp | fine | 1 | 985 | 1,000 | 98.50% | -0.10 | 0.093284 | 23,480 | 2,935 | 1.097× | 25 | 7.840× | 1.737× | 19,320 | 1.142 | 2.157 |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.096896 | 21,432 | 2,679 | 1.202× | 196 | 1.000× | 1.333× | 5,456 | 1.040 | 1.125 |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 6 | 986 | 1,000 | 98.60% | +0.00 | 0.086638 | 21,432 | 2,679 | 1.202× | 147 | 1.333× | 1.428× | 5,456 | 1.040 | 1.267 |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.085034 | 21,432 | 2,679 | 1.202× | 98 | 2.000× | 1.537× | 5,456 | 1.040 | 1.487 |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 3 | 986 | 1,000 | 98.60% | +0.00 | 0.085729 | 21,432 | 2,679 | 1.202× | 74 | 2.649× | 1.599× | 5,456 | 1.040 | 1.654 |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 2 | 983 | 1,000 | 98.30% | -0.30 | 0.088235 | 21,432 | 2,679 | 1.202× | 49 | 4.000× | 1.665× | 5,456 | 1.040 | 1.923 |
| FP6-E3M2-PG-kernel[25,25,24] | 6 | group | fp | kernel | 1 | 988 | 1,000 | 98.80% | +0.20 | 0.098327 | 21,432 | 2,679 | 1.202× | 25 | 7.840× | 1.737× | 5,456 | 1.040 | 2.441 |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 8 | 985 | 1,000 | 98.50% | -0.10 | 0.093547 | 20,408 | 2,551 | 1.262× | 196 | 1.000× | 1.333× | 3,880 | 1.028 | 1.157 |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 6 | 985 | 1,000 | 98.50% | -0.10 | 0.089106 | 20,408 | 2,551 | 1.262× | 147 | 1.333× | 1.428× | 3,880 | 1.028 | 1.302 |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 4 | 984 | 1,000 | 98.40% | -0.20 | 0.085903 | 20,408 | 2,551 | 1.262× | 98 | 2.000× | 1.537× | 3,880 | 1.028 | 1.528 |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 3 | 982 | 1,000 | 98.20% | -0.40 | 0.093159 | 20,408 | 2,551 | 1.262× | 74 | 2.649× | 1.599× | 3,880 | 1.028 | 1.700 |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 2 | 982 | 1,000 | 98.20% | -0.40 | 0.087110 | 20,408 | 2,551 | 1.262× | 49 | 4.000× | 1.665× | 3,880 | 1.028 | 1.977 |
| FP6-E3M2-PG-coarse[25,50,48] | 6 | group | fp | coarse | 1 | 985 | 1,000 | 98.50% | -0.10 | 0.103304 | 20,408 | 2,551 | 1.262× | 25 | 7.840× | 1.737× | 3,880 | 1.028 | 2.509 |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 8 | 981 | 1,000 | 98.10% | -0.50 | 0.084442 | 12,260 | 1,533 | 2.101× | 196 | 1.000× | 2.667× | 19,320 | 2.134 | 0.832 |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 6 | 980 | 1,000 | 98.00% | -0.60 | 0.085863 | 12,260 | 1,533 | 2.101× | 147 | 1.333× | 2.856× | 19,320 | 2.134 | 0.937 |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 4 | 981 | 1,000 | 98.10% | -0.50 | 0.095755 | 12,260 | 1,533 | 2.101× | 98 | 2.000× | 3.075× | 19,320 | 2.134 | 1.100 |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 3 | 980 | 1,000 | 98.00% | -0.60 | 0.092595 | 12,260 | 1,533 | 2.101× | 74 | 2.649× | 3.197× | 19,320 | 2.134 | 1.223 |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 2 | 974 | 1,000 | 97.40% | -1.20 | 0.090049 | 12,260 | 1,533 | 2.101× | 49 | 4.000× | 3.330× | 19,320 | 2.134 | 1.423 |
| BitMoD-FP3-Adaptive-PG-fine[5,10,16] | 3 | group | bitmod_adaptive | fine | 1 | 964 | 1,000 | 96.40% | -2.20 | 0.083285 | 12,260 | 1,533 | 2.101× | 25 | 7.840× | 3.474× | 19,320 | 2.134 | 1.806 |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 8 | 974 | 1,000 | 97.40% | -1.20 | 0.081950 | 10,980 | 1,373 | 2.346× | 196 | 1.000× | 2.667× | 5,456 | 1.320 | 1.396 |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 6 | 975 | 1,000 | 97.50% | -1.10 | 0.081631 | 10,980 | 1,373 | 2.346× | 147 | 1.333× | 2.856× | 5,456 | 1.320 | 1.572 |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 4 | 976 | 1,000 | 97.60% | -1.00 | 0.093674 | 10,980 | 1,373 | 2.346× | 98 | 2.000× | 3.075× | 5,456 | 1.320 | 1.844 |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 3 | 974 | 1,000 | 97.40% | -1.20 | 0.086582 | 10,980 | 1,373 | 2.346× | 74 | 2.649× | 3.197× | 5,456 | 1.320 | 2.052 |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 2 | 973 | 1,000 | 97.30% | -1.30 | 0.104326 | 10,980 | 1,373 | 2.346× | 49 | 4.000× | 3.330× | 5,456 | 1.320 | 2.386 |
| BitMoD-FP3-Adaptive-PG-kernel[25,25,24] | 3 | group | bitmod_adaptive | kernel | 1 | 962 | 1,000 | 96.20% | -2.40 | 0.093793 | 10,980 | 1,373 | 2.346× | 25 | 7.840× | 3.474× | 5,456 | 1.320 | 3.028 |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 8 | 981 | 1,000 | 98.10% | -0.50 | 0.093672 | 10,340 | 1,293 | 2.491× | 196 | 1.000× | 2.667× | 3,880 | 1.228 | 1.531 |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 6 | 981 | 1,000 | 98.10% | -0.50 | 0.084324 | 10,340 | 1,293 | 2.491× | 147 | 1.333× | 2.856× | 3,880 | 1.228 | 1.724 |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 4 | 981 | 1,000 | 98.10% | -0.50 | 0.082701 | 10,340 | 1,293 | 2.491× | 98 | 2.000× | 3.075× | 3,880 | 1.228 | 2.023 |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 3 | 977 | 1,000 | 97.70% | -0.90 | 0.090431 | 10,340 | 1,293 | 2.491× | 74 | 2.649× | 3.197× | 3,880 | 1.228 | 2.251 |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 2 | 980 | 1,000 | 98.00% | -0.60 | 0.086767 | 10,340 | 1,293 | 2.491× | 49 | 4.000× | 3.330× | 3,880 | 1.228 | 2.617 |
| BitMoD-FP3-Adaptive-PG-coarse[25,50,48] | 3 | group | bitmod_adaptive | coarse | 1 | 964 | 1,000 | 96.40% | -2.20 | 0.084755 | 10,340 | 1,293 | 2.491× | 25 | 7.840× | 3.474× | 3,880 | 1.228 | 3.322 |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 8 | 986 | 1,000 | 98.60% | +0.00 | 0.093437 | 15,480 | 1,935 | 1.664× | 196 | 1.000× | 2.000× | 19,320 | 2.134 | 0.700 |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 6 | 987 | 1,000 | 98.70% | +0.10 | 0.083580 | 15,480 | 1,935 | 1.664× | 147 | 1.333× | 2.142× | 19,320 | 2.134 | 0.788 |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 4 | 987 | 1,000 | 98.70% | +0.10 | 0.089296 | 15,480 | 1,935 | 1.664× | 98 | 2.000× | 2.306× | 19,320 | 2.134 | 0.924 |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 3 | 985 | 1,000 | 98.50% | -0.10 | 0.097195 | 15,480 | 1,935 | 1.664× | 74 | 2.649× | 2.398× | 19,320 | 2.134 | 1.028 |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 2 | 985 | 1,000 | 98.50% | -0.10 | 0.086438 | 15,480 | 1,935 | 1.664× | 49 | 4.000× | 2.497× | 19,320 | 2.134 | 1.196 |
| BitMoD-FP4-Adaptive-PG-fine[5,10,16] | 4 | group | bitmod_adaptive | fine | 1 | 985 | 1,000 | 98.50% | -0.10 | 0.091436 | 15,480 | 1,935 | 1.664× | 25 | 7.840× | 2.605× | 19,320 | 2.134 | 1.518 |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 8 | 988 | 1,000 | 98.80% | +0.20 | 0.090532 | 14,200 | 1,775 | 1.814× | 196 | 1.000× | 2.000× | 5,456 | 1.320 | 1.164 |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 6 | 988 | 1,000 | 98.80% | +0.20 | 0.092709 | 14,200 | 1,775 | 1.814× | 147 | 1.333× | 2.142× | 5,456 | 1.320 | 1.311 |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 4 | 987 | 1,000 | 98.70% | +0.10 | 0.084081 | 14,200 | 1,775 | 1.814× | 98 | 2.000× | 2.306× | 5,456 | 1.320 | 1.538 |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.091456 | 14,200 | 1,775 | 1.814× | 74 | 2.649× | 2.398× | 5,456 | 1.320 | 1.711 |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 2 | 988 | 1,000 | 98.80% | +0.20 | 0.085081 | 14,200 | 1,775 | 1.814× | 49 | 4.000× | 2.497× | 5,456 | 1.320 | 1.990 |
| BitMoD-FP4-Adaptive-PG-kernel[25,25,24] | 4 | group | bitmod_adaptive | kernel | 1 | 981 | 1,000 | 98.10% | -0.50 | 0.083204 | 14,200 | 1,775 | 1.814× | 25 | 7.840× | 2.605× | 5,456 | 1.320 | 2.525 |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 8 | 987 | 1,000 | 98.70% | +0.10 | 0.089453 | 13,560 | 1,695 | 1.900× | 196 | 1.000× | 2.000× | 3,880 | 1.228 | 1.271 |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 6 | 988 | 1,000 | 98.80% | +0.20 | 0.089655 | 13,560 | 1,695 | 1.900× | 147 | 1.333× | 2.142× | 3,880 | 1.228 | 1.431 |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 4 | 986 | 1,000 | 98.60% | +0.00 | 0.096239 | 13,560 | 1,695 | 1.900× | 98 | 2.000× | 2.306× | 3,880 | 1.228 | 1.679 |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 3 | 987 | 1,000 | 98.70% | +0.10 | 0.097216 | 13,560 | 1,695 | 1.900× | 74 | 2.649× | 2.398× | 3,880 | 1.228 | 1.868 |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 2 | 984 | 1,000 | 98.40% | -0.20 | 0.088142 | 13,560 | 1,695 | 1.900× | 49 | 4.000× | 2.497× | 3,880 | 1.228 | 2.173 |
| BitMoD-FP4-Adaptive-PG-coarse[25,50,48] | 4 | group | bitmod_adaptive | coarse | 1 | 980 | 1,000 | 98.00% | -0.60 | 0.085771 | 13,560 | 1,695 | 1.900× | 25 | 7.840× | 2.605× | 3,880 | 1.228 | 2.758 |
{% endraw %}


</div>
