---
layout: single
title: "Sanger: A Co-Design Framework for Enabling Sparse Attention using Reconfigurable Architecture, MICRO 2021"
categories: Paper_review
tags: PR
toc: true
author_profile: false
comments: true
---


# ◼︎ Abstract

최근 attention 기반 모델이 많아졌지만 attention mechenism에는 본질적으로 많은 수의 불필요한 연산이 있음. 그래서 이를 해결하기 위해 sparse attention이 주목받고 있고 이는 sampled dense-dense matrix multiplication(SDDMM)즉 sparse-dense matrix multiplication(SpMM)에 나오는 0값을 하드웨어적으로 제거할 수 있어야 함. 하지만 sparse pattern이 불규칙하면 하드웨어 효율이 낮고, 규칙적인 pattern에 대해 하면 연산 절감 효과가 제한적임. 
 
그래서 Sanger를 제안하는 것이고 소프트웨어 부분은 attention matrix를 동적인 구조적 패턴으로 pruning하며, 하드웨어 부분은 이러한 패턴을 활용할 수 있는 재구성 가능한 아키텍처를 제공함. 

# ◼︎ Introduction

<center><img src="/images/PR/Ten_lesson/figure1.jpg" width = "700"><br></center>

Google의 첫 번째 DNN DSA인 TPUv1은 추론을 처리하며 초록색으로 표시된 SRAM 블록인 Activation Storage와 Accumulators는 파란색 연산 블록인 Matrix Multiply Unit(MXU)과 Activation Pipeline 사이에서 데이터를 임시로 저장함. 

TPUv2는 더 어려운 작업인 학습을 대상으로 함. 

1. 병렬화 하기 힘듬. 추론은 서로 독립적이지만 학습은 모델에 대해 하나의 일관된 가중치 집합을 생성해야하므로 복잡.
2. 연산이 더 어려움. Back propagation이 있어야하기 때문에 복잡함. 
3. 더 많은 메모리 필요함.
4. 학습용 장치는 더 높은 프로그래밍 가능성을 염두해야함.
5. FP 연산 필요함.

TPUv2에서는 Activation Storage와 Accumulators를 하나의 Vector Memory로 통합함. Activation Pipeline이 더 프로그래밍 가능한 Vector Unit으로 교체함. 학습에는 대규모 확장이 필요하므로 또 다른 개선 사항으로 사용자 정의 칩 간 연결망인 Inter-Chip Interconnect(ICI)가 추가됨. 칩당 두 개의 TensorCore가 있음. TPUv3는 동일한 반도체 공정에서 TPUv2를 비교적 가볍게 재설계한 midlife kicker임. 

이 논문은 5년 동안 TPU를 제작하고 배포하면서 힘들게 얻은 교훈을 바탕으로 만들어진 TPUv4i를 소개함. 이름의 i는 inference를 의미함.

# ◼︎ Ten Lessons Learned Since 2015

Google이 2015년부터 TPU를 실제 데이터센터에 배포하면서 얻은 10가지 핵심 교훈을 정리한 부분임. 단순히 연산 성능만 높이는 것이 아니라, 컴파일러·메모리·전력·냉각·모델 성장·서비스 지연시간까지 함께 고려해야 한다는 점을 강조함.

## ① Logic, Wires, SRAM, DRAM Improve Unequally

반도체 공정이 발전하더라도 논리 회로, 배선, SRAM, DRAM이 동일한 속도로 개선되는 것은 아님.

45nm에서 7nm로 발전하면서 연산 에너지 효율은 평균 약 2.6배 개선되었지만, SRAM과 배선의 개선 폭은 상대적으로 작았음. 반면 HBM은 패키징 기술의 발전으로 기존 DDR보다 높은 대역폭과 에너지 효율을 제공함.

따라서 최신 가속기에서는 연산기 자체보다 데이터를 저장하고 이동하는 비용이 더 중요한 문제가 됨. 논리 회로가 상대적으로 저렴해졌기 때문에 TPUv4i에는 더 많은 MXU를 배치할 수 있었음.

## ② Leverage Prior Compiler Optimizations

새로운 하드웨어의 성능은 컴파일러의 품질에 크게 영향을 받음.

TPU는 XLA 컴파일러를 사용하며, 동일한 하드웨어에서도 컴파일러 최적화를 통해 성능이 크게 향상되었음. MLPerf Training 0.5에서 0.7로 발전하는 약 20개월 동안 XLA는 TPU 성능을 약 2.2배 높였음.

따라서 완전히 새로운 ISA를 설계하는 것보다 기존 TPU와 XLA에서 축적된 최적화를 계속 활용할 수 있도록 설계하는 것이 중요함.

## ③ Design for Performance per TCO, Not per CapEx

가속기를 설계할 때 초기 구매 비용보다 전체 사용 기간의 비용을 고려해야 함.

- **CapEx**: 장비의 구매 및 구축 비용임
- **OpEx**: 전기, 냉각, 유지보수 등의 운영 비용임
- **TCO**: 장비를 사용하는 전체 기간의 총비용임

단순히 최고 성능이나 면적당 성능을 높이면 소비 전력과 냉각 비용이 증가할 수 있음. 따라서 Google은 제품 출시 시점의 벤치마크 성능보다 전체 수명 동안의 성능/TCO를 중요하게 봄.

Google의 TPU와 NVIDIA T4를 분석한 결과, 시스템 TDP와 TCO의 상관계수는 `R = 0.99`였음. TCO를 알 수 없는 경우 TDP를 대체 지표로 사용할 수 있다는 의미임.

## ④ Support Backwards ML Compatibility

새로운 TPU에서도 이전 TPU에서 학습하고 실행한 모델이 유사한 결과와 성능 특성을 보여야 함.

이를 위해 새로운 추론용 TPU도 기존 TPU에서 사용하던 `bfloat16`, `fp32` 및 주요 연산을 지원해야 함. 부동소수점 연산은 계산 순서에 따라 결과가 달라질 수 있으므로, 새로운 TPU에서도 동일한 컴파일러가 비슷한 방식으로 코드를 생성하는 것이 중요함.

이러한 호환성을 통해 기존 모델을 다시 수정하거나 검증하는 시간을 줄이고 빠르게 배포할 수 있음.

## ⑤ Inference DSAs Need Air Cooling for Global Scale

추론용 가속기는 전 세계 데이터센터에 배포되어야 하므로 공랭식 냉각이 가능해야 함.

TPUv3는 칩 TDP가 450W에 달해 주로 수랭식 냉각을 사용함. 수랭식 시스템은 별도의 냉각 설비와 여러 개의 인접한 서버 랙이 필요함.

학습용 TPU는 일부 대형 데이터센터에 집중 배치해도 되지만, 추론용 TPU는 사용자와 가까운 여러 지역에 배치해야 함. 따라서 추론용 가속기는 설치 제약을 줄이기 위해 낮은 TDP와 공랭식 냉각을 지원해야 함.

## ⑥ Some Inference Apps Need Floating-Point Arithmetic

정수 양자화는 연산 면적과 전력 사용량을 줄일 수 있지만, 일부 모델에서는 정확도를 떨어뜨릴 수 있음.

TPUv1은 정수 연산만 지원했기 때문에 일부 애플리케이션은 양자화로 감소한 정확도를 복구하는 데 수개월의 추가 작업이 필요했음.

따라서 추론 가속기는 양자화를 지원할 수는 있지만 모든 모델에 강제해서는 안 됨. TPUv4i는 `int8`과 `bfloat16`을 모두 지원하여 모델에 따라 적절한 자료형을 선택할 수 있도록 설계됨.

## ⑦ Production Inference Normally Needs Multi-Tenancy

실제 추론 환경에서는 하나의 가속기에서 여러 DNN을 함께 실행하는 경우가 일반적임.

예를 들어 번역 서비스는 여러 언어 조합의 모델을 실행해야 하며, 음성 인식 서비스는 여러 방언 모델을 지원해야 함. 기존 모델과 신규 모델을 동시에 실행하면서 일부 사용자에게만 새로운 모델을 배포하는 경우도 있음.

Google의 실제 추론 워크로드 중 80% 이상이 멀티테넌시를 필요로 했음. 모델을 빠르게 전환하려면 여러 모델의 가중치를 저장할 수 있는 로컬 DRAM이나 HBM이 필요함.

## ⑧ DNNs Grow About 1.5× per Year

Google의 실제 DNN은 메모리 사용량과 연산량이 매년 약 1.5배씩 증가했음.

벤치마크 모델은 고정되어 있지만 실제 서비스 모델은 정확도와 기능 향상을 위해 계속 커짐. 현재 모델만 겨우 처리하도록 가속기를 설계하면 제품 수명이 끝나기 전에 성능과 메모리가 부족해질 수 있음.

따라서 DSA에는 미래 모델의 성장을 고려한 연산 성능, 메모리 용량, 대역폭의 여유인 **headroom**이 필요함.

## ⑨ DNN Workloads Evolve With DNN Breakthroughs

새로운 DNN 구조가 등장하면 실제 추론 워크로드의 구성도 빠르게 변화함.

2016년에 사용되던 MLP와 CNN은 2020년에도 계속 사용되었지만, BERT는 등장한 지 약 2년 만에 Google 추론 워크로드의 28%를 차지했음. 일부 LSTM 기반 모델도 Transformer encoder와 Wave RNN 등의 새로운 구조로 교체되었음.

따라서 특정 모델만 빠르게 처리하는 고정형 가속기보다 새로운 DNN 구조에 대응할 수 있는 프로그래밍 가능성과 유연성이 필요함.

## ⑩ Inference SLO Limit Is P99 Latency, Not Batch Size

실제 추론 서비스의 제한 조건은 배치 크기 자체가 아니라 P99 지연시간임.

**P99 latency**는 전체 요청 중 99%가 해당 시간 안에 처리된다는 의미임. 여러 요청을 하나의 배치로 묶어도 서비스의 P99 지연시간 기준을 만족한다면 배치 크기를 크게 사용할 수 있음.

Google의 실제 워크로드는 지연시간 SLO를 만족하면서도 배치 크기 8~200을 사용했음. 따라서 가속기는 배치 크기를 무조건 1로 제한하기보다, 지연시간 기준을 만족하는 범위에서 더 큰 배치를 사용하여 처리량을 높여야 함.

## 핵심 정리

Google이 TPU를 실제 데이터센터에서 운영하면서 얻은 결론은 AI 가속기의 최대 연산 성능만 높여서는 안 된다는 것임.

TPUv4i 설계에 반영된 핵심 기준은 다음과 같음.

1. 연산기보다 발전이 느린 메모리와 배선의 비용을 줄여야 함
2. 기존 컴파일러 최적화를 계속 활용할 수 있어야 함
3. 초기 비용보다 전력과 냉각을 포함한 TCO를 고려해야 함
4. 이전 TPU에서 학습한 모델을 빠르게 배포할 수 있어야 함
5. 전 세계 배포를 위해 공랭식 냉각이 가능해야 함
6. 정수 양자화를 강제하지 않고 부동소수점 연산도 지원해야 함
7. 여러 모델을 실행하기 위한 멀티테넌시가 필요함
8. 매년 커지는 DNN을 위한 성능과 메모리 여유가 필요함
9. 새로운 모델 구조에 대응할 수 있는 유연성이 필요함
10. 배치 크기보다 P99 지연시간을 기준으로 설계해야 함

이 10가지 교훈은 TPUv4i의 MXU 수, HBM과 CMEM, 지원 자료형, TDP, 냉각 방식 및 소프트웨어 구조를 결정한 기반임.

# ◼︎ How the 10 Lessons Shaped TPUv4i’s Design

Section 3은 앞에서 제시한 10가지 교훈이 TPUv4i의 실제 설계에 어떻게 반영되었는지를 설명하는 부분임. Figure 5는 TPUv4i 구성 요소 사이의 논리적 연결 구조를 보여주며, Figure 6은 각 구성 요소가 실제 칩 면적에 어떻게 배치되었는지를 보여줌.

<center><img src="/images/PR/Ten_lesson/figure5_6.jpg" width = "800"><br></center>

## TPUv3 구조와 XLA 컴파일러 계승

TPUv4i는 완전히 새로운 아키텍처를 만드는 대신 TPUv3의 TensorCore 구조와 XLA 컴파일러 체계를 계승함. 이는 기존 컴파일러 최적화를 재사용하고, 이전 TPU에서 학습한 모델을 새로운 TPU에 빠르게 배포하기 위한 선택임.

Google은 기존에 컴파일된 명령어를 새로운 TPU에서도 그대로 실행하는 **binary compatibility**보다, 기존 프로그램을 XLA로 다시 컴파일하여 새로운 하드웨어를 활용하는 **compiler compatibility**를 선택함.

이를 통해 TPUv4i에서 MXU 수, 메모리 구조, VLIW 명령어 형식이 변경되더라도 기존 XLA의 고수준 최적화를 계속 활용할 수 있음.

Google은 동일한 핵심 코어 설계를 바탕으로 다음 두 종류의 칩을 개발함.

- **TPUv4i**: 단일 코어 기반의 추론용 칩임
- **TPUv4**: 듀얼 코어 기반의 학습용 칩임

두 칩은 동일한 코어와 유사한 uncore 구조를 공유하므로, 학습용과 추론용 칩을 완전히 별도로 설계하는 것보다 개발 비용을 줄일 수 있음.

## TensorCore의 연산 구조

Figure 5와 Figure 6에서 파란색으로 표시된 영역은 실제 연산을 수행하는 TensorCore임.

주요 구성 요소는 다음과 같음.

- **MXU(Matrix Multiply Unit)**: DNN의 핵심 연산인 행렬곱을 처리함
- **VPU(Vector Processing Unit)**: 활성화 함수, 정규화, element-wise 연산 등 벡터 연산을 처리함
- **VMEM(Vector Memory)**: VPU와 MXU가 사용하는 빠른 온칩 메모리임
- **XLU(Cross-Lane Unit)**: 여러 vector lane 사이의 데이터 이동과 교환을 담당함
- **TCS(TensorCore Sequencer)**: TensorCore의 명령 실행 순서를 제어함
- **SMEM(Scalar Memory)**: scalar 데이터를 저장함
- **IMEM(Instruction Memory)**: TPU가 실행할 명령어를 저장함

TPUv4i는 하나의 TensorCore에 총 4개의 MXU를 배치함. TPUv3는 코어당 2개의 MXU를 사용했으므로, TPUv4i에서는 코어당 MXU 수가 두 배 증가한 것임.

7nm 공정에서는 논리 회로가 배선이나 SRAM보다 상대적으로 빠르게 개선되었기 때문에 더 많은 MXU를 배치할 수 있었음. 또한 새롭게 추가된 CMEM이 4개의 MXU에 충분한 데이터를 공급할 수 있었기 때문에 연산기 증가가 실제 성능 향상으로 이어질 수 있었음.

## CMEM을 추가한 메모리 계층

TPUv4i의 가장 중요한 변화 중 하나는 128MB의 **Common Memory(CMEM)**를 추가한 것임.

TPUv4i의 주요 메모리 계층은 다음과 같이 구성됨.

```text
VMEM → CMEM → HBM
빠르고 작음        느리지만 큼
```

VMEM은 TensorCore 내부에 위치하여 가장 빠르게 접근할 수 있지만 용량이 작음. HBM은 대용량 데이터를 저장할 수 있지만 칩 외부에 있기 때문에 접근 에너지와 지연시간이 큼.

CMEM은 VMEM과 HBM 사이에 위치하는 대용량 온칩 SRAM임. VMEM에 들어가지 않는 데이터를 CMEM에 저장하면 외부 HBM에 접근하는 횟수를 줄일 수 있음.

SRAM은 DRAM보다 에너지 효율이 높기 때문에 CMEM은 다음과 같은 효과를 제공함.

- HBM 접근 횟수를 줄임
- 메모리 대역폭 병목을 완화함
- 데이터 이동에 필요한 전력을 줄임
- 여러 MXU에 데이터를 더 빠르게 공급함
- P99 추론 지연시간을 개선함

Figure 6에서 CMEM은 전체 칩 면적의 약 28%를 차지함. 이는 TPUv4i가 단순히 연산기 수를 늘린 칩이 아니라, 데이터 이동 비용을 줄이기 위해 상당한 면적을 메모리에 투자한 칩임을 보여줌.

## Figure 5: TPUv4i의 논리적 연결 구조

Figure 5는 TPUv4i의 각 구성 요소가 어떤 방식으로 연결되는지를 보여주는 블록 다이어그램임.

중앙에는 TensorCore와 CMEM, OCI가 위치함. TensorCore에서 처리할 데이터는 VMEM과 CMEM에 저장되며, 더 큰 데이터는 HBM에 저장됨.

주요 데이터 흐름은 다음과 같이 정리할 수 있음.

```text
HBM
 ↓
HBMC
 ↓
OCI
 ↓
CMEM
 ↓
TensorCore
 ├─ MXU
 ├─ VPU
 ├─ VMEM
 └─ XLU
```

- **HBMC(HBM Controller)**는 HBM 접근을 제어함
- **OCI(On-Chip Interconnect)**는 칩 내부 구성 요소 사이의 데이터 이동을 담당함
- **CMEM**은 HBM에서 가져온 데이터를 일시적으로 저장함
- **TensorCore**는 CMEM과 VMEM의 데이터를 이용해 실제 연산을 수행함

왼쪽의 PCIe Controller와 UHI는 호스트 CPU와 TPU 사이의 데이터 및 명령 전달을 담당함. 오른쪽의 ICR과 LST는 다른 TPUv4i 칩과의 통신을 담당함.

## Figure 6: TPUv4i의 실제 칩 배치

Figure 6은 각 장치가 실제 칩 면적에 어떻게 배치되었는지를 보여주는 floorplan임.

칩의 중앙에는 VPU와 VMEM이 배치되어 있으며, 그 좌우에 4개의 MXU가 위치함. MXU와 VPU 사이에는 XLU가 배치되어 vector lane 사이의 데이터 교환을 지원함.

대형 CMEM 블록은 TensorCore의 위와 아래에 배치되어 있음. CMEM이 TensorCore 가까이에 위치하므로 여러 MXU와 VPU가 데이터를 빠르게 가져올 수 있음.

칩의 바깥쪽에는 다음과 같은 uncore 장치가 배치됨.

- OCI
- HBM Controller와 SerDes
- PCIe Controller
- UHI
- ICI Router
- ICI Link Stack
- Chip Manager

Figure 6의 전체 다이 크기는 400mm² 미만이며, CMEM이 약 28%를 차지함. TensorCore와 CMEM이 칩의 주요 면적을 결정하고 있으며, OCI는 이들 구성 요소 사이의 남은 공간을 활용하도록 길게 배치되어 있음.

## OCI 기반의 칩 내부 연결

Figure 5의 **OCI(On-Chip Interconnect)**는 TensorCore, CMEM, HBM Controller, 호스트 인터페이스와 ICI를 연결하는 공용 칩 내부 네트워크임.

기존 TPU에서는 각 구성 요소를 point-to-point 방식으로 직접 연결했음. 그러나 메모리와 연산 장치의 수가 증가하면 연결선이 복잡해지고 배선 자원과 칩 면적이 크게 증가하는 문제가 발생함.

TPUv4i는 모든 주요 구성 요소를 OCI에 연결함으로써 HBM, CMEM, VMEM 사이의 데이터를 더 유연하게 이동할 수 있도록 설계됨.

TPUv4i의 기본 메모리 접근 단위는 512B임. 이 512B 데이터는 내부적으로 4개의 128B 그룹으로 나뉨.

```text
512B memory word
├─ 128B Group 0
├─ 128B Group 1
├─ 128B Group 2
└─ 128B Group 3
```

각 그룹은 OCI의 서로 다른 영역을 통해 데이터를 전달하며, 각각 약 153GB/s의 HBM 대역폭을 담당함. 네 그룹을 합치면 약 614GB/s의 전체 HBM 대역폭을 제공함.

이 구조는 하나의 거대한 네트워크가 모든 데이터를 처리하는 것보다 다음과 같은 장점이 있음.

- 긴 배선을 줄일 수 있음
- 데이터 접근의 지역성을 높일 수 있음
- 네트워크 충돌을 줄일 수 있음
- OCI의 중재 로직을 단순화할 수 있음
- 배선 자원과 전력 사용량을 줄일 수 있음

## 4차원 Tensor DMA

TPUv4i는 DNN에서 사용하는 다차원 Tensor를 효율적으로 이동하기 위해 **4차원 Tensor DMA**를 사용함.

DMA는 TensorCore가 직접 데이터를 하나씩 옮기지 않아도 메모리 사이에서 대량의 데이터를 전송하는 장치임.

TPUv2와 TPUv3의 DMA는 주로 2차원 데이터 이동을 지원했지만, TPUv4i는 다음과 같은 4차원 Tensor 구조를 직접 처리할 수 있음.

```text
Batch × Height × Width × Channel
```

4차원 Tensor DMA는 다음과 같은 작업을 지원함.

- Tensor 복사
- reshape
- scatter
- gather
- memset
- 칩 내부 메모리 사이의 전송
- 서로 다른 TPU 칩 사이의 전송
- 호스트 CPU와 TPU 사이의 전송

Source와 destination의 stride를 각각 독립적으로 설정할 수 있으므로 데이터를 복사하면서 배열 구조를 변경할 수 있음.

이를 통해 TensorCore가 주소 계산이나 데이터 재배열을 직접 수행하는 시간을 줄이고, MXU와 VPU가 실제 연산에 더 집중할 수 있음.

TPUv4i는 칩 내부 전송, 칩 간 전송, 호스트 전송에 동일한 DMA 구조를 사용함. 따라서 단일 TPU에서 여러 TPU로 프로그램을 확장할 때 소프트웨어 구조를 크게 변경할 필요가 없음.

## ICI를 통한 칩 간 연결

Figure 5의 오른쪽에는 다른 TPUv4i 칩과 통신하기 위한 ICI 구조가 나타남.

주요 구성 요소는 다음과 같음.

- **ICR(ICI Router)**: 칩 간 데이터의 전송 경로를 결정함
- **LST(ICI Link Stack)**: TPU 칩 사이의 실제 고속 통신 링크를 담당함
- **SerDes**: 병렬 데이터를 직렬 데이터로 변환하거나 다시 병렬 데이터로 변환함

하나의 TPUv4i 보드에는 총 4개의 칩이 배치되며, 이 칩들은 ICI를 통해 서로 연결됨.

미래의 DNN이 하나의 TPUv4i 메모리에 들어가지 않을 정도로 커지면 모델을 여러 칩에 나누는 model partitioning을 사용할 수 있음.

TPUv4i는 TPUv3보다 ICI link 수를 줄여 전력과 비용을 낮췄지만, 여러 칩의 메모리를 활용할 수 있는 기본적인 확장성은 유지함.

## 호스트 CPU와의 연결

Figure 5의 왼쪽에는 호스트 CPU와 TPUv4i를 연결하는 구조가 나타남.

주요 구성 요소는 다음과 같음.

- **PCIe Controller**: 호스트 CPU와 TPU 사이의 물리적 통신을 담당함
- **UHI(Unified Host Interface)**: 호스트와 TPU 내부 장치 사이의 데이터 흐름을 관리함
- **MGR(Chip Manager)**: 칩의 설정, 관리 및 펌웨어 동작을 담당함

호스트 CPU는 PCIe를 통해 모델의 입력과 출력, 제어 정보를 TPUv4i와 교환함. TPU 내부에서는 UHI와 OCI를 통해 데이터가 CMEM, HBM, TensorCore로 전달됨.

## 지원하는 연산 형식

TPUv4i는 추론용 가속기이지만 정수 연산만 지원하지 않음.

지원하는 주요 수치 형식은 다음과 같음.

- **int8**: TPUv1용으로 양자화된 기존 추론 모델을 지원함
- **bfloat16**: TPUv2와 TPUv3에서 학습한 모델과의 ML 호환성을 유지함
- **fp32**: 높은 정밀도가 필요한 일부 연산을 지원함

일부 모델은 int8 양자화를 적용하면 정확도가 감소하거나 배포까지 추가적인 최적화 시간이 필요함. 따라서 TPUv4i는 양자화를 선택적으로 사용할 수 있도록 부동소수점 연산을 함께 지원함.

## MXU와 4-input Adder 개선

TPUv4i는 하나의 TensorCore에 4개의 MXU를 배치함. 증가한 MXU와 CMEM을 제어하기 위해 TPUv4i의 VLIW 명령어는 TPUv3보다 약 25% 넓어짐.

Google은 binary compatibility를 유지하지 않았기 때문에 새로운 MXU와 CMEM을 제어하기 위한 필드를 VLIW 명령어에 자유롭게 추가할 수 있었음.

또한 TPUv4i는 MXU 내부의 부동소수점 덧셈 구조를 개선함.

기존 방식은 128개의 곱셈 결과를 이전 partial sum에 순차적으로 더하는 방식이었음.

```text
Partial sum + Result 1 + Result 2 + ... + Result 128
```

TPUv4i는 먼저 4개의 곱셈 결과를 하나의 그룹으로 묶음.

```text
Result 1~4의 합
Result 5~8의 합
...
Result 125~128의 합
```

이후 32개의 그룹 결과를 partial sum에 더함. 이를 통해 시스톨릭 배열의 critical path를 기존 방식의 약 4분의 1로 줄임.

전용 4-input 부동소수점 adder는 중간 결과의 일부 반올림과 정규화 과정을 제거함. 그 결과 기존 구조와 비교하여 다음과 같은 효과를 얻음.

- adder 면적 약 40% 절감
- adder 전력 약 25% 절감
- MXU 최대 전력 약 12% 절감
- 중간 반올림 감소로 수치 정확도 개선
- ML 결과에는 의미 있는 정확도 변화가 없음

MXU는 칩에서 전력 밀도가 가장 높은 장치이므로 이러한 최적화는 TPUv4i의 TDP와 냉각 방식에 직접적인 영향을 줌.

## 클럭과 TDP 최적화

TPUv4i는 가장 높은 클럭과 최대 성능만을 목표로 설계된 칩이 아님.

Google은 전 세계 데이터센터에 쉽게 배포할 수 있도록 다음과 같이 설계함.

- 클럭 속도: 1.05GHz
- 칩 TDP: 175W
- 냉각 방식: 공랭식

TPUv3의 칩 TDP는 450W로 주로 수랭식 냉각이 필요했음. 반면 TPUv4i는 전력 사용량과 전력 밀도를 줄여 일반적인 공랭식 서버 환경에서도 사용할 수 있도록 설계됨.

이는 초기 칩 가격이나 순간적인 최고 성능보다 전기, 냉각, 배포 비용을 포함한 전체 TCO를 줄이기 위한 선택임.

## 워크로드 분석 기능

TPUv4i에는 실제 사용자 워크로드의 병목을 분석하기 위한 tracing 기능과 performance counter가 포함되어 있음.

이를 통해 다음 정보를 측정할 수 있음.

- MXU와 VPU의 사용률
- HBM과 CMEM 접근량
- DMA 대역폭과 대기시간
- OCI 내부의 병목
- 칩 간 ICI 통신량
- 메모리 접근 패턴
- 연산 장치의 대기시간

이러한 하드웨어 기능은 칩 면적과 설계 비용을 증가시키지만, 제품이 배포된 이후에도 XLA 컴파일러와 애플리케이션을 지속적으로 최적화할 수 있게 함.

Google은 출시 시점의 면적당 성능보다 제품의 전체 사용 기간 동안 성능과 개발 생산성을 높이는 것이 더 중요하다고 판단함.


# ◼︎ TPUv4i Performance Analysis

이 절에서는 Google의 실제 추론 애플리케이션과 MLPerf Inference 벤치마크를 이용해 TPUv4i의 성능과 전력 효율을 분석함. 주요 비교 대상은 이전 세대인 TPUv3와 NVIDIA의 추론용 GPU인 T4임.

**핵심 결과**

- 실제 Google 워크로드에서 TPUv4i와 TPUv3의 성능은 모두 TPUv2의 약 1.9배임
- TPUv4i의 성능/TDP는 TPUv3보다 약 2.3배 높음
- MLPerf에서 TPUv4i는 NVIDIA T4보다 약 1.3~1.6배 빠름
- 단순한 최고 성능보다 전력, 메모리, 냉각을 포함한 성능/TCO를 개선한 것이 핵심임

## TPU 세대별 실제 워크로드 성능

Figure 8은 Google의 실제 프로덕션 추론 애플리케이션에서 TPU 세대별 성능을 TPUv2 기준으로 비교한 결과임.

<table class="tpu-table">
  <thead>
    <tr>
      <th>TPU</th>
      <th>TPUv2 대비 성능</th>
      <th>특징</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>TPUv1</td>
      <td>약 0.7배</td>
      <td>초기 추론 전용 구조임</td>
    </tr>
    <tr>
      <td>TPUv3</td>
      <td>약 1.9배</td>
      <td>2코어 기반의 학습·추론용 칩임</td>
    </tr>
    <tr>
      <td>TPUv4i</td>
      <td>약 1.9배</td>
      <td>1코어 기반의 추론 전용 칩임</td>
    </tr>
  </tbody>
</table>

TPUv4i는 TPUv3와 비슷한 성능을 제공하지만 칩 TDP는 TPUv3의 450W에서 175W로 크게 감소함. 따라서 추론 성능 자체보다 전력과 냉각 비용을 고려한 효율에서 큰 이점을 가짐.

## TPUv3 대비 전력 효율

TPUv4i의 실제 프로덕션 워크로드 성능/TDP는 TPUv3보다 약 2.3배 높게 측정됨.

이러한 결과는 다음 변화가 함께 작용한 결과임.

- 최대 연산 성능이 123TFLOPS에서 138TFLOPS로 증가함
- 온칩 SRAM이 32MB에서 144MB로 약 4.5배 증가함
- 칩 TDP가 450W에서 175W로 감소함
- 코어당 MXU 수가 2개에서 4개로 증가함
- 7nm 공정과 CMEM을 통해 메모리 및 연산 효율이 개선됨

**성능/TDP 개선 요인**

CMEM이 약 1.5배, 7nm 공정이 약 1.3배의 개선에 기여했으며, 나머지 구조 개선이 약 1.2배의 추가 효과를 제공한 것으로 분석됨.


즉, TPUv4i는 트랜지스터 수만 증가시킨 칩이 아니라 CMEM, MXU 활용률, 전력 설계와 같은 여러 구조적 개선을 통해 높은 전력 효율을 달성한 칩임.

## NVIDIA T4와의 비교

Figure 9는 MLPerf Inference 벤치마크에서 TPUv4i와 NVIDIA T4의 성능을 비교함.

T4는 ResNet50과 SSD에서 `int8`을 사용하고 NMT에서는 `fp16`을 사용함. 반면 TPUv4i는 이전 TPU와의 ML 호환성을 유지하기 위해 모든 모델에서 `bfloat16`을 사용함.

<table class="tpu-table">
  <thead>
    <tr>
      <th>비교 항목</th>
      <th>TPUv4i 결과</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>T4 대비 추론 성능</td>
      <td>약 1.3~1.6배</td>
    </tr>
    <tr>
      <td>T4 대비 성능/TDP</td>
      <td>약 0.9~1.0배</td>
    </tr>
    <tr>
      <td>NMT 성능/TDP</td>
      <td>약 1.3배</td>
    </tr>
  </tbody>
</table>

TPUv4i는 전체 성능에서는 T4보다 빠르지만 시스템 TDP까지 고려한 효율은 평균적으로 비슷한 수준임.

다만 NMT처럼 두 장치가 모두 부동소수점 연산을 사용하는 경우 TPUv4i의 성능/TDP가 T4보다 높게 나타남.

## SSD 성능이 낮은 이유

SSD 벤치마크에서는 TPUv4i의 상대적인 효율이 낮게 나타남.

SSD에는 Non-Max Suppression과 여러 gather 연산이 포함되어 있으며, 이러한 연산은 계산량보다 불규칙한 메모리 접근의 영향을 크게 받음.

논문에서는 GPU의 coalescing memory 구조가 TPU의 HBM보다 이러한 접근 패턴을 더 효율적으로 처리했을 가능성이 있다고 설명함.

## 핵심 정리

TPUv4i는 TPUv3보다 절대 성능이 크게 높아진 것은 아니지만 훨씬 낮은 전력으로 유사한 성능을 제공함.

핵심적인 의미는 다음과 같음.

1. TPUv3와 비슷한 실제 추론 성능을 유지함
2. TPUv3 대비 성능/TDP를 약 2.3배 개선함
3. NVIDIA T4보다 추론 처리 속도가 약 1.3~1.6배 빠름
4. CMEM과 대용량 온칩 SRAM이 메모리 병목을 줄임
5. 175W TDP를 통해 공랭식 데이터센터 배포가 가능함
6. `bfloat16`을 유지하여 기존 TPU 학습 모델을 빠르게 배포할 수 있음

결국 TPUv4i의 목표는 벤치마크 최고 성능이 아니라, 실제 Google 추론 워크로드에서 전력과 냉각을 포함한 전체 성능/TCO를 높이는 것임.
