---
layout: single
title: "BitMoD Bit-serial Mixture-of-Datatype LLM Acceleration, HPCA 2025"
categories: Paper_review
tags: ["PR", "CA", "AI Accelerator", "LLM", "Quantization", "Bit-Serial", "Hardware-Software Co-Design", "BitMoD"]
toc: true
author_profile: false
comments: true
---


# ◼︎ Abstract

LLM에서 막대한 메모리 용량은 실제 환경에 모델을 배포하는데 방해됨. 그래서 quantize하지만 error가 커지게 되어 정확도가 떨어짐. BitMoD는 높은 정확도를 유지하면서 quantization 가능함. BitMoD는 비트 직렬 처리 요소(bit-serial processing element)를 사용함. 

# ◼︎ Introduction

메모리 사용량을 줄이기 위해 결국 quantization은 필요함. 보통 quantization 방식은 두 종류로 분류됨.

> 1. QAT(양자화 인식 학습): 재학습 필요
> 2. PTQ(학습 후 양자화): 재학습 필요X

QAT는 PTQ보다 더 우수한 정확도를 달성할 수 있지만, LLM을 다시 학습시키는 데 필요한 막대한 비용 때문에 실용성이 낮아서 기존 LLM 양자화 연구에서는 일반적으로 PTQ가 사용됨. 대부분 그래서 weight-only quantization 방식을 사용하지만 연산 효율이 낮다는 문제가 있음. GPU에는 정수 가중치와 부동소수점 활성값 사이의 곱셈을 직접 처리하는 전용 하드웨어가 없기 때문에 양자화된 가중치를 먼저 FP16으로 역양자화한 뒤, GPU의 부동소수점 연산 파이프라인을 사용하여 계산해야 함. 

| 방식 | 의미 | 재학습 | 장점 | 단점 |
|---|---|---|---|---|
| QAT | 양자화 오차를 고려하면서 모델을 다시 학습 | 필요 | 정확도가 비교적 높음 | LLM 재학습 비용이 매우 큼 |
| PTQ | 이미 학습된 모델을 이후에 양자화 | 불필요 | 빠르고 적용이 쉬움 | QAT보다 정확도 손실 가능 |
| Weight-only PTQ | 가중치만 저정밀화 | 불필요 | 정확도 유지와 메모리 절감의 균형 | 기존 GPU에서는 연산 비효율 발생 |

**FIGNA**

Integer Weight×Floating-point Activation

기존 GPU처럼 가중치를 먼저 FP16으로 복원하지 않고, 정수 가중치와 FP activation을 직접 계산하려는 접근임.

**Microscaling**

Microscaling은 여러 개의 저정밀 값이 하나의 exponent를 공유하함.

``` text
저정밀 가중치 그룹
w₁, w₂, w₃, …, wₙ
       +
공유 exponent
```

각 가중치마다 exponent를 저장하지 않으므로 데이터 크기를 줄일 수 있지만, 공유 exponent를 처리하기 위한 부가적인 하드웨어가 필요함.

**ANT**

ANT는 하나의 데이터 타입만 사용하지 않고, 텐서의 값 분포에 맞는 데이터 타입을 선택함. 값의 분포에 적합한 표현 방식을 선택해 양자화 오차를 줄이는 방법임.

다만 뒤의 Background 부분에서 설명되듯이 ANT의 데이터 타입은 주로 per-channel quantization을 기준으로 설계되었기 때문에, per-group 환경에서는 항상 가장 좋은 성능을 내지 못함. 

**OliVe**

OliVe는 매우 큰 값인 outlier를 보호하기 위해 주변의 작은 값을 희생함.

``` text
[일반값, 작은 victim 값, 큰 outlier 값, 일반값]
              ↓ 제거       ↓ 보호
```

작은 victim 값을 표현 대상에서 제외하고, 확보한 표현 공간을 큰 outlier를 저장하는 데 사용함.

이 방식은 outlier의 영향을 줄일 수 있지만, 정상적인 값을 하나 제거해야 하며 특수한 데이터 표현과 복잡한 하드웨어가 필요함.

BitMoD는 per-group quantization을 활용하며, 저정밀 부동소수점 데이터 타입에서 중복되는 0 값을 특별한 값으로 재사용함. 이를 통해 데이터 타입 자체가 각 가중치 그룹의 수치 분포에 더욱 잘 적응할 수 있도록 함.

# ◼︎ Background And Motivation

## A. Why Weight Quantization for LLMs?

LLM 추론에서 메모리에 저장되는 주요 데이터는 크게 다음과 같음. 

Weight
- 모델 자체의 파라미터
- 추론 과정에서 계속 재사용됨

Activation
- 현재 입력을 처리하며 생성되는 중간 결과
- 입력 및 배치 크기에 따라 변화함

배치 크기가 1이면 activation 재사용 기회가 적고, 매우 큰 가중치를 계속 메모리에서 가져와야 함. 따라서 가중치를 FP16에서 4비트나 3비트로 줄이면 다음과 같은 효과가 발생함.
FP16→INT4 또는 FP4 = 16 bit→4 bit

이론적으로 가중치 저장 용량과 가중치 메모리 전송량을 약 4분의 1로 줄일 수 있음.

## B. Quantization Basics

### Symmetric Integer Quantization

$$
\Delta = \frac{W_{f\max}}{2^{b-1}-1}
$$

$$
W_q = \operatorname{Round}\left(\frac{W_f}{\Delta}\right)
$$

$$
W_{qf} = W_q \cdot \Delta
$$

대칭 양자화는 원본 실수 값의 범위를 0을 중심으로 하는 정수 범위에 대응시키는 방식임.

예를 들어 4비트 signed integer를 대칭 양자화에 사용하면 다음과 같은 정수 범위를 사용함.

$$
-7,-6,\ldots,0,\ldots,+6,+7
$$

4비트로는 총 16개의 bit pattern을 표현할 수 있지만, 대칭 양자화에서는 양수와 음수의 절댓값 범위를 동일하게 맞추기 위해 일반적으로 $-7$부터 $+7$까지의 범위를 사용함.

원본 가중치 중 절댓값이 가장 큰 값이 3.5라고 가정함.

4비트 양자화에서는 $b=4$이므로 scaling factor는 다음과 같이 계산됨.

$$
\Delta
=
\frac{3.5}{2^{4-1}-1}
=
\frac{3.5}{7}
=
0.5
$$

따라서 정수 값이 1만큼 변할 때마다 실제 가중치 값은 0.5만큼 변하게 됨.

즉, 양자화된 정수 값과 실제 값의 대응 관계는 다음과 같음.

| 양자화된 정수 $W_q$ | 대응되는 실수 값 |
|---:|---:|
| -2 | -1.0 |
| -1 | -0.5 |
| 0 | 0 |
| 1 | 0.5 |
| 2 | 1.0 |
| 3 | 1.5 |

원본 가중치가 1.2라고 가정함.

먼저 원본 값을 scaling factor로 나눔.

$$
\frac{W_f}{\Delta}
=
\frac{1.2}{0.5}
=
2.4
$$

계산된 값을 가장 가까운 정수로 반올림함.

$$
W_q
=
\operatorname{Round}(2.4)
=
2
$$

따라서 원본 가중치 1.2는 양자화된 정수 2로 변환됨.

``` text
원본 가중치 1.2
        ↓ scaling factor로 나눔
       2.4
        ↓ 반올림
양자화된 정수 2
```
### Asymmetric Integer Quantization

대칭 양자화는 원본 텐서의 최솟값과 최댓값이 0을 중심으로 동일한 절댓값을 가진다고 가정함.

그러나 실제 가중치의 분포는 항상 대칭적이지 않음. 예를 들어 가중치 범위가 $-1.0$부터 $3.0$까지라면 양수 방향의 범위가 더 넓으므로, 0을 중심으로 대칭인 양자화 범위를 사용하면 일부 표현 공간이 낭비됨.

비대칭 정수 양자화는 이러한 문제를 해결하기 위해 **scaling factor와 zero-point를 함께 사용하여 정수 표현 범위를 원본 데이터의 최솟값과 최댓값에 맞추는 방식**임.

양자화 과정은 다음 식으로 표현됨.

$$
\Delta
=
\frac{\operatorname{Range}(W_f)}{2^b-1}
$$

$$
z
=
\operatorname{Round}
\left(
\frac{-W_{f\min}}{\Delta}
\right)
$$

$$
W_q
=
\operatorname{Round}
\left(
\frac{W_f}{\Delta}
\right)
+
z
$$

$$
W_{qf}
=
(W_q-z)\cdot\Delta
$$

원본 가중치의 범위가 다음과 같다고 가정함.

$$
-1.0 \leq W_f \leq 3.0
$$

4비트 비대칭 정수 양자화를 적용하며, 양자화된 정수의 범위는 다음과 같음.

$$
0 \leq W_q \leq 15
$$

비대칭 정수 양자화는 다음 순서로 수행함.

원본 가중치의 최솟값과 최댓값은 다음과 같음.

$$
W_{f\min}=-1.0
$$

$$
W_{f\max}=3.0
$$

따라서 전체 범위는 다음과 같이 계산됨.

$$
\operatorname{Range}(W_f)
=
W_{f\max}-W_{f\min}
$$

$$
\operatorname{Range}(W_f)
=
3.0-(-1.0)
=
4.0
$$

비대칭 정수 양자화의 scaling factor는 다음과 같이 계산함.

$$
\Delta
=
\frac{\operatorname{Range}(W_f)}{2^b-1}
$$

4비트 양자화를 적용하므로 $b=4$를 대입함.

$$
\Delta
=
\frac{4.0}{2^4-1}
=
\frac{4.0}{15}
\approx
0.2667
$$

따라서 양자화된 정수 값이 1만큼 변할 때 실제 가중치는 약 0.2667만큼 변함.

Zero-point는 원본 실수 값 0이 양자화된 정수 범위에서 어느 위치에 대응되는지를 나타냄.

$$
z
=
\operatorname{Round}
\left(
\frac{-W_{f\min}}{\Delta}
\right)
$$

원본 가중치의 최솟값과 scaling factor를 대입하면 다음과 같음.

$$
z
=
\operatorname{Round}
\left(
\frac{-(-1.0)}{0.2667}
\right)
$$

$$
z
=
\operatorname{Round}(3.75)
=
4
$$

따라서 원본 실수 값 0은 양자화된 정수 값 4에 대응됨.

```text
실수 값      -1.0           0                        3.0
              ↓           ↓                         ↓
정수 값         0           4                        15
```

원본 가중치가 1.3이라고 가정함.

비대칭 정수 양자화 식은 다음과 같음.

$$
W_q
=
\operatorname{Round}
\left(
\frac{W_f}{\Delta}
\right)
+
z
$$

앞에서 계산한 값을 대입하면 다음과 같음.

$$
W_q
=
\operatorname{Round}
\left(
\frac{1.3}{0.2667}
\right)
+
4
$$

$$
W_q
=
\operatorname{Round}(4.875)+4
$$

$$
W_q
=
5+4
=
9
$$

따라서 원본 가중치 1.3은 4비트 정수 값 9로 양자화됨.

```text
원본 가중치 1.3
        ↓
Scaling factor 0.2667로 나눔
        ↓
약 4.875
        ↓
가장 가까운 정수로 반올림
        ↓
5
        ↓
Zero-point 4를 더함
        ↓
양자화된 정수 9
```

## C. Motivation

주로 weight quantization에 초점을 맞출거임.

### Quantization Granularity(세분성, 입자의 굵고 가는 정도) Matters

Quantization Granularity는 양자화를 수행할 때 몇 개의 Weight가 하나의 Scaling Factor를 공유할 것인지 결정하는 기준임.

BitMoD 논문에서는 Weight Quantization의 Granularity를 다음 세 가지로 구분함.

1. Per-Tensor Quantization
2. Per-Channel Quantization
3. Per-Group Quantization

LLM처럼 Weight Tensor의 크기와 Hidden Dimension이 큰 모델에서는 Granularity가 너무 크면 Outlier의 영향을 많은 Weight가 함께 받게 되어 Quantization Error가 증가할 수 있음.


#### 1. Quantization Granularity란?

다음과 같은 Floating-Point Weight Tensor를 생각할 수 있음.

$$
W_f \in \mathbb{R}^{K \times D}
$$

여기서 각 기호의 의미는 다음과 같음.

- $K$: Output Channel의 개수임
- $D$: 각 Channel에 포함된 Weight의 개수임

예를 들어 $K=2$, $D=8$이라면 다음과 같은 Weight Tensor가 있다고 볼 수 있음.

```text
                 D = 8

Channel 1  [ w1  w2  w3  w4  w5  w6  w7  w8 ]
Channel 2  [ w1  w2  w3  w4  w5  w6  w7  w8 ]

     ↑
   K = 2
```

Quantization Granularity의 핵심은 다음과 같음.

> 이 Weight들을 어느 범위까지 묶어 하나의 Scaling Factor를 사용할 것인지 결정하는 것임.

---

#### 2. Per-Tensor Quantization

Per-Tensor Quantization은 **전체 Weight Tensor가 하나의 Scaling Factor를 공유하는 방식**임.

예를 들어 다음과 같은 Weight Tensor가 있다고 가정함.

```text
Channel 1  [ 0.2  -0.3   0.4  -0.1   0.1  -0.2   0.3   4.0 ]
Channel 2  [ 0.5  -0.4   0.2  -0.1   0.6  -0.5   0.4  -0.3 ]
```

Per-Tensor 방식에서는 위의 모든 Weight가 동일한 Scaling Factor를 사용함.

```text
┌───────────────────────────────────────────────────────┐
│ Channel 1                                             │
│ Channel 2                                             │
│                                                       │
│              Scaling Factor Δ 하나                     │
└───────────────────────────────────────────────────────┘
```

4-bit Symmetric Quantization을 사용한다고 가정하면 정수 표현 범위는 다음과 같음.

$$
-7 \sim +7
$$

전체 Tensor에서 절댓값이 가장 큰 값은 4.0임.

따라서 Scaling Factor는 다음과 같이 계산됨.

$$
\Delta
=
\frac{4.0}{2^{4-1}-1}
=
\frac{4.0}{7}
\approx
0.5714
$$

결과적으로 Tensor 안의 모든 Weight가 다음 Scaling Factor를 사용함.

$$
\Delta \approx 0.5714
$$


#### 3. Per-Tensor의 문제점

위 Weight Tensor를 보면 대부분의 Weight는 다음처럼 작은 값을 가짐.

```text
0.1
0.2
0.3
0.4
0.5
...
```

하지만 Channel 1에 `4.0`이라는 큰 값이 하나 존재함.

```text
[ 0.2  -0.3   0.4  -0.1   0.1  -0.2   0.3   4.0 ]
                                             ↑
                                           Outlier
```

Per-Tensor Quantization에서는 이 Outlier 하나 때문에 전체 Tensor의 Scaling Factor가 크게 결정됨.

$$
\Delta \approx 0.5714
$$

예를 들어 원본 Weight가 0.3이라면 다음과 같이 양자화됨.

$$
W_q
=
\operatorname{Round}
\left(
\frac{0.3}{0.5714}
\right)
$$

$$
W_q
=
\operatorname{Round}(0.525)
=
1
$$

이 정수 값 1이 표현하는 실제 값은 다음과 같음.

$$
1 \times 0.5714
=
0.5714
$$

따라서 다음과 같은 차이가 발생함.

```text
원본 Weight     = 0.3
양자화 근사값   = 0.5714
```

즉, Tensor 전체에서 하나의 Outlier가 존재할 경우 해당 Outlier가 Scaling Factor를 크게 만들고, 그 결과 Tensor 안의 작은 Weight들을 정밀하게 표현하기 어려워짐.

> Per-Tensor 방식의 핵심 문제는 하나의 Outlier가 Tensor 전체의 Quantization에 영향을 줄 수 있다는 점임.

#### 4. Per-Channel Quantization

Per-Channel Quantization은 **각 Output Channel마다 서로 다른 Scaling Factor를 사용하는 방식**임.

앞의 예시를 그대로 사용하면 다음과 같음.

```text
Channel 1  [ 0.2 -0.3 0.4 -0.1 0.1 -0.2 0.3 4.0 ] → Δ₁

Channel 2  [ 0.5 -0.4 0.2 -0.1 0.6 -0.5 0.4 -0.3 ] → Δ₂
```

Channel 1의 절댓값 최댓값은 4.0이므로 Scaling Factor는 다음과 같음.

$$
\Delta_1
=
\frac{4.0}{7}
\approx
0.5714
$$

Channel 2의 절댓값 최댓값은 0.6이므로 Scaling Factor는 다음과 같음.

$$
\Delta_2
=
\frac{0.6}{7}
\approx
0.0857
$$

결과를 정리하면 다음과 같음.

| Channel | Absolute Maximum | Scaling Factor |
|---|---:|---:|
| Channel 1 | 4.0 | 0.5714 |
| Channel 2 | 0.6 | 0.0857 |

Per-Tensor에서는 Channel 2도 0.5714라는 큰 Scaling Factor를 사용해야 했음.

하지만 Per-Channel에서는 Channel 2가 독립적으로 0.0857이라는 훨씬 작은 Scaling Factor를 사용할 수 있으므로 Weight를 더 정밀하게 표현할 수 있음.

#### 5. Per-Channel도 여전히 문제가 존재함

Per-Channel Quantization은 Per-Tensor보다 세밀하지만, 같은 Channel 내부에서는 여전히 하나의 Scaling Factor를 공유함.

Channel 1을 다시 보면 다음과 같음.

```text
Channel 1

[ 0.2  -0.3   0.4  -0.1   0.1  -0.2   0.3   4.0 ]
                                             ↑
                                          Outlier
```

Channel 1에 존재하는 대부분의 값은 작은 값이지만, 마지막에 4.0이라는 Outlier가 존재함.

Per-Channel 방식에서는 Channel 1 전체가 동일한 Scaling Factor를 사용하기 때문에 다음과 같음.

$$
\Delta_1
=
0.5714
$$

따라서 Channel 앞부분의

```text
0.2, -0.3, 0.4, -0.1
```

과 같은 작은 Weight도 4.0이라는 Outlier의 영향을 받게 됨.

즉,

> Per-Channel 방식은 Outlier의 영향이 다른 Channel까지 전달되는 것은 막을 수 있지만, 같은 Channel 안에 존재하는 Weight들은 여전히 영향을 받음.

LLM은 Hidden Dimension 자체가 매우 크기 때문에 하나의 Channel에 포함되는 Weight 수도 많음.

따라서 Per-Channel만 사용하더라도 하나의 Outlier가 많은 Weight의 Quantization에 영향을 줄 수 있음.

#### 6. Per-Group Quantization

이러한 문제를 해결하기 위해 최근 LLM Quantization 연구에서는 **Per-Group Quantization**을 사용함.

Per-Group Quantization은 하나의 Weight Channel을 다시 여러 개의 작은 Group으로 나누는 방식임.

하나의 Weight Channel이 다음과 같다고 가정함.

$$
W_f^{1 \times D}
$$

Group Size를 $G$라고 하면 하나의 Channel은 다음 개수의 Group으로 분할됨.

$$
\frac{D}{G}
$$

이해하기 쉽게 앞의 Channel을 Group Size 4로 나누면 다음과 같음.

```text
Channel 1

Group 1                     Group 2
┌──────────────────┐       ┌──────────────────┐
[0.2 -0.3 0.4 -0.1 ]       [0.1 -0.2 0.3 4.0  ] 
└──────────────────┘       └──────────────────┘
        ↓                           ↓
        Δ₁                          Δ₂
```

각 Group이 독립적인 Scaling Factor를 가지게 됨.

Group 1의 절댓값 최댓값은 0.4임.

따라서 Scaling Factor는 다음과 같음.

$$
\Delta_1
=
\frac{0.4}{7}
\approx
0.0571
$$

Group 2의 절댓값 최댓값은 4.0임.

따라서 Scaling Factor는 다음과 같음.

$$
\Delta_2
=
\frac{4.0}{7}
\approx
0.5714
$$

이를 정리하면 다음과 같음.

| Group | Weight | Absolute Maximum | Scaling Factor |
|---|---|---:|---:|
| Group 1 | 0.2, -0.3, 0.4, -0.1 | 0.4 | 0.0571 |
| Group 2 | 0.1, -0.2, 0.3, 4.0 | 4.0 | 0.5714 |

여기서 중요한 점은 4.0이라는 Outlier의 영향이 **Group 2 내부로 제한된다는 것임.**

Group 1은 Outlier의 영향을 받지 않으므로 훨씬 작은 Scaling Factor를 사용할 수 있음.

#### 7. 같은 Weight를 양자화하여 비교

원본 Weight가 다음과 같다고 가정함.

$$
W_f = 0.3
$$

이 Weight가 Group 1에 포함되어 있다고 가정함.

##### Per-Tensor

Per-Tensor에서 Scaling Factor는 다음과 같았음.

$$
\Delta
=
0.5714
$$

따라서

$$
W_q
=
\operatorname{Round}
\left(
\frac{0.3}{0.5714}
\right)
$$

$$
W_q
=
\operatorname{Round}(0.525)
=
1
$$

양자화된 값이 표현하는 실제 값은 다음과 같음.

$$
1 \times 0.5714
=
0.5714
$$

원본 값 0.3과 비교하면 상당한 차이가 발생함.

##### Per-Channel

Channel 1에는 4.0이라는 Outlier가 있기 때문에 Scaling Factor는 Per-Tensor와 동일하게 다음과 같음.

$$
\Delta
=
0.5714
$$

따라서 원본 Weight 0.3은 마찬가지로 약 0.5714로 표현됨.

##### Per-Group

Group 1의 Scaling Factor는 다음과 같음.

$$
\Delta
=
0.0571
$$

따라서

$$
W_q
=
\operatorname{Round}
\left(
\frac{0.3}{0.0571}
\right)
$$

$$
W_q
=
\operatorname{Round}(5.25)
=
5
$$

양자화된 값이 표현하는 실제 값은 다음과 같음.

$$
5 \times 0.0571
\approx
0.2855
$$

원본 Weight 0.3에 훨씬 가까운 값으로 표현됨.

결과를 비교하면 다음과 같음.

| 방식 | Scaling Factor | 원본 값 | 양자화 근사값 | 대략적인 오차 |
|---|---:|---:|---:|---:|
| Per-Tensor | 0.5714 | 0.3 | 0.5714 | 0.2714 |
| Per-Channel | 0.5714 | 0.3 | 0.5714 | 0.2714 |
| **Per-Group** | **0.0571** | **0.3** | **0.2855** | **0.0145** |

즉, Per-Group에서는 Outlier가 속한 Group만 큰 Scaling Factor를 사용하고, 다른 Group은 작은 Scaling Factor를 사용할 수 있음.

#### 8. Scaling Factor가 작으면 왜 좋은가?

$$
\operatorname{Error}(W_{qf})
=
\operatorname{Error}_{Round}
\left(
\frac{W_f}{\Delta}
\right)
\cdot
\Delta
$$

여기서 $\operatorname{Error}_{Round}$는 Quantization 과정에서 발생하는 Rounding Error임.

중요한 점은 Quantization Error가 Scaling Factor $\Delta$에 비례한다는 것임.

$$
\text{Quantization Error}
\propto
\Delta
$$

Scaling Factor는 쉽게 말하면 **양자화된 값 사이의 간격**이라고 볼 수 있음.

Scaling Factor가 큰 경우를 생각하면 다음과 같음.

$$
\Delta = 0.5
$$

```text
0 ───────── 0.5 ───────── 1.0 ───────── 1.5
```

표현 가능한 값 사이의 간격이 넓기 때문에 0.2, 0.3, 0.4처럼 중간에 위치한 값을 정확하게 표현하기 어려움.

반대로 Scaling Factor가 작으면 다음과 같음.

$$
\Delta = 0.1
$$

```text
0 ── 0.1 ── 0.2 ── 0.3 ── 0.4 ── 0.5
```

표현 가능한 값의 간격이 더 촘촘해지기 때문에 원본 Weight를 더 정밀하게 표현할 수 있음.

<style>
/* =========================================================
   BitMoD - Quantization Granularity 전용 영역
   모든 CSS는 .bitmod-qg-section 내부에만 적용됨
   ========================================================= */

.bitmod-qg-section {
  --qg-card-bg: rgba(127, 127, 127, 0.035);
  --qg-border: rgba(127, 127, 127, 0.28);
  --qg-border-strong: rgba(127, 127, 127, 0.55);

  --qg-header-bg: #303642;
  --qg-header-text: #f5f6f8;

  --qg-accent: #5b8cff;
  --qg-accent-bg: rgba(79, 124, 255, 0.10);
  --qg-accent-border: rgba(79, 124, 255, 0.70);

  width: 100%;
  margin: 32px 0;

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Pretendard",
    "Segoe UI",
    sans-serif;

  line-height: 1.7;
  box-sizing: border-box;
}


/* 이 영역 내부에서만 box-sizing 통일 */
.bitmod-qg-section *,
.bitmod-qg-section *::before,
.bitmod-qg-section *::after {
  box-sizing: border-box;
}


/* =========================================================
   제목 및 설명
   ========================================================= */

.bitmod-qg-section .qg-title {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 750;
  line-height: 1.35;
}

.bitmod-qg-section .qg-intro {
  margin: 0 0 30px;
  line-height: 1.85;
}

.bitmod-qg-section .qg-subtitle {
  margin: 42px 0 20px;
  font-size: 23px;
  font-weight: 750;
}


/* =========================================================
   비교 TABLE
   ========================================================= */

.bitmod-qg-section .qg-table-wrapper {
  width: 100%;
  margin: 24px 0 38px;

  overflow-x: auto;

  border: 1px solid var(--qg-border);
  border-radius: 14px;
}


/* GitBlog 기본 Table CSS 간섭 방지 */
.bitmod-qg-section table.qg-table {
  display: table !important;

  width: 100% !important;
  min-width: 850px !important;

  table-layout: fixed !important;

  margin: 0 !important;
  padding: 0 !important;

  border: none !important;
  border-collapse: collapse !important;
  border-spacing: 0 !important;

  background: transparent !important;

  font-size: 15px !important;
}


/* thead / tbody / tr 구조 강제 복원 */
.bitmod-qg-section .qg-table thead {
  display: table-header-group !important;
  width: 100% !important;
}

.bitmod-qg-section .qg-table tbody {
  display: table-row-group !important;
  width: 100% !important;
}

.bitmod-qg-section .qg-table tr {
  display: table-row !important;
  width: 100% !important;
}


/* ---------- Header ---------- */

.bitmod-qg-section .qg-table thead tr {
  background: var(--qg-header-bg) !important;
}

.bitmod-qg-section .qg-table thead th {
  display: table-cell !important;

  padding: 17px 20px !important;

  background: var(--qg-header-bg) !important;
  color: var(--qg-header-text) !important;

  border: none !important;
  border-bottom:
    1px solid rgba(255, 255, 255, 0.18) !important;

  text-align: left !important;
  vertical-align: middle !important;

  font-size: 14px !important;
  font-weight: 700 !important;
  line-height: 1.45 !important;

  white-space: nowrap;
}


/* ---------- Body ---------- */

.bitmod-qg-section .qg-table tbody tr {
  background: transparent !important;
}

.bitmod-qg-section .qg-table tbody td {
  display: table-cell !important;

  padding: 18px 20px !important;

  background: transparent !important;
  color: inherit !important;

  border: none !important;
  border-bottom:
    1px solid var(--qg-border) !important;

  text-align: left !important;
  vertical-align: middle !important;

  line-height: 1.55 !important;
}


/* 마지막 행의 하단 선 제거 */
.bitmod-qg-section .qg-table tbody tr:last-child td {
  border-bottom: none !important;
}


/* 첫 번째 열 강조 */
.bitmod-qg-section .qg-table tbody td:first-child {
  font-weight: 700 !important;
  white-space: nowrap;
}


/* ---------- Per-Group Highlight ---------- */

.bitmod-qg-section
.qg-table
tbody
tr.qg-table-highlight {
  background: var(--qg-accent-bg) !important;
}

.bitmod-qg-section
.qg-table
tbody
tr.qg-table-highlight
td {
  background: var(--qg-accent-bg) !important;
}

.bitmod-qg-section
.qg-table
tbody
tr.qg-table-highlight
td:first-child {
  color: var(--qg-accent) !important;
}


/* ---------- Column Width ---------- */

.bitmod-qg-section .qg-table th:nth-child(1),
.bitmod-qg-section .qg-table td:nth-child(1) {
  width: 15%;
}

.bitmod-qg-section .qg-table th:nth-child(2),
.bitmod-qg-section .qg-table td:nth-child(2) {
  width: 23%;
}

.bitmod-qg-section .qg-table th:nth-child(3),
.bitmod-qg-section .qg-table td:nth-child(3) {
  width: 20%;
}

.bitmod-qg-section .qg-table th:nth-child(4),
.bitmod-qg-section .qg-table td:nth-child(4) {
  width: 25%;
}

.bitmod-qg-section .qg-table th:nth-child(5),
.bitmod-qg-section .qg-table td:nth-child(5) {
  width: 17%;
}


/* =========================================================
   구조적 차이 CARD
   ========================================================= */

.bitmod-qg-section .qg-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: 18px;
  align-items: start;

  width: 100%;
}


.bitmod-qg-section .qg-card {
  display: flex;
  flex-direction: column;

  padding: 22px;

  background: var(--qg-card-bg);

  border: 1px solid var(--qg-border);
  border-radius: 16px;
}


/* Per-Group 강조 */
.bitmod-qg-section .qg-card.qg-card-group {
  background: var(--qg-accent-bg);

  border:
    1.5px solid var(--qg-accent-border);
}


/* Card 제목 */
.bitmod-qg-section .qg-card-title {
  margin: 0;

  font-size: 19px;
  font-weight: 750;
}

.bitmod-qg-section
.qg-card-group
.qg-card-title {
  color: var(--qg-accent);
}


/* Card 설명 */
.bitmod-qg-section .qg-card-desc {
  min-height: 50px;

  margin: 8px 0 20px;

  font-size: 14px;
  line-height: 1.65;

  opacity: 0.78;
}


/* =========================================================
   Tensor / Channel / Group 구조 BOX
   ========================================================= */

.bitmod-qg-section .qg-structure {
  display: flex;
  flex-direction: column;

  gap: 9px;
}


.bitmod-qg-section .qg-box {
  display: flex;

  min-height: 92px;

  flex-direction: column;
  align-items: center;
  justify-content: center;

  padding: 15px 10px;

  border: 2px solid var(--qg-border-strong);
  border-radius: 10px;

  text-align: center;
}


/* Box 이름 */
.bitmod-qg-section .qg-box-name {
  font-size: 17px;
  font-weight: 700;
}


/* Scaling Factor */
.bitmod-qg-section .qg-scale {
  margin-top: 7px;

  font-size: 13px;
  font-weight: 600;

  opacity: 0.65;
}


/* =========================================================
   Per-Group 2 × 2 구조
   ========================================================= */

.bitmod-qg-section .qg-group-grid {
  display: grid;

  grid-template-columns: repeat(2, 1fr);

  gap: 9px;
}


/* Per-Group 내부 Box 강조 */
.bitmod-qg-section
.qg-card-group
.qg-box {
  border-color: var(--qg-accent-border);
}


/* =========================================================
   Card 하단 설명
   ========================================================= */

.bitmod-qg-section .qg-card-point {
  margin-top: 20px;

  padding-top: 17px;

  border-top:
    1px dashed var(--qg-border-strong);

  font-size: 14px;
  line-height: 1.75;
}


.bitmod-qg-section .qg-card-point strong {
  display: block;

  margin-bottom: 3px;
}


/* =========================================================
   Granularity 진행 방향
   ========================================================= */

.bitmod-qg-section .qg-direction {
  margin: 36px 0 16px;

  text-align: center;
}


.bitmod-qg-section .qg-direction-main {
  display: flex;

  align-items: center;
  justify-content: center;

  flex-wrap: wrap;

  gap: 10px;

  font-size: 17px;
  font-weight: 700;
}


.bitmod-qg-section .qg-arrow {
  font-size: 19px;

  opacity: 0.65;
}


.bitmod-qg-section .qg-group-text {
  color: var(--qg-accent);
}


.bitmod-qg-section .qg-direction-note {
  margin-top: 10px;

  font-size: 14px;

  opacity: 0.7;
}


/* =========================================================
   최종 Trade-off 요약
   ========================================================= */

.bitmod-qg-section .qg-summary {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  margin-top: 18px;

  border: 1px solid var(--qg-border);
  border-radius: 14px;

  overflow: hidden;
}


.bitmod-qg-section .qg-summary-item {
  padding: 18px 20px;
}


.bitmod-qg-section
.qg-summary-item
+
.qg-summary-item {
  border-left: 1px solid var(--qg-border);
}


.bitmod-qg-section .qg-summary-label {
  display: block;

  margin-bottom: 5px;

  font-size: 13px;
  font-weight: 650;

  opacity: 0.65;
}


.bitmod-qg-section .qg-summary-value {
  font-size: 18px;
  font-weight: 750;
}


.bitmod-qg-section
.qg-summary-value.qg-good {
  color: var(--qg-accent);
}


/* =========================================================
   모바일
   ========================================================= */

@media (max-width: 900px) {

  .bitmod-qg-section .qg-card-grid {
    grid-template-columns: 1fr;
  }

  .bitmod-qg-section .qg-card-desc {
    min-height: auto;
  }

  .bitmod-qg-section .qg-summary {
    grid-template-columns: 1fr;
  }

  .bitmod-qg-section
  .qg-summary-item
  +
  .qg-summary-item {
    border-left: none;
    border-top:
      1px solid var(--qg-border);
  }

}

</style>


<!-- =========================================================
     Quantization Granularity Content
     ========================================================= -->

<div class="bitmod-qg-section">


  <!-- 제목 -->
  <div class="qg-title">
    Quantization Granularity 비교
  </div>


  <!-- 설명 -->
  <p class="qg-intro">

    Quantization Granularity는
    <strong>
      몇 개의 Weight가 하나의 Scaling Factor를 공유할 것인지
    </strong>
    를 결정하는 기준임.

    Granularity가 세밀해질수록 Outlier의 영향을 더 작은 범위로
    제한할 수 있어 Quantization Error를 줄이는 데 유리함.

    반면 각 영역마다 별도의 Scaling Factor를 저장해야 하므로
    Metadata가 증가하는 Trade-off가 존재함.

  </p>


  <!-- =====================================================
       비교 Table
       ===================================================== -->

  <div class="qg-table-wrapper">

    <table class="qg-table">

      <thead>

        <tr>

          <th>
            방식
          </th>

          <th>
            Scaling Factor 공유 범위
          </th>

          <th>
            Outlier 영향 범위
          </th>

          <th>
            Quantization 정확도
          </th>

          <th>
            Metadata
          </th>

        </tr>

      </thead>


      <tbody>

        <!-- Per-Tensor -->
        <tr>

          <td>
            Per-Tensor
          </td>

          <td>
            Tensor 전체
          </td>

          <td>
            Tensor 전체
          </td>

          <td>
            상대적으로 불리함
          </td>

          <td>
            가장 적음
          </td>

        </tr>


        <!-- Per-Channel -->
        <tr>

          <td>
            Per-Channel
          </td>

          <td>
            Channel 하나
          </td>

          <td>
            해당 Channel
          </td>

          <td>
            Per-Tensor보다 유리함
          </td>

          <td>
            증가함
          </td>

        </tr>


        <!-- Per-Group -->
        <tr class="qg-table-highlight">

          <td>
            Per-Group
          </td>

          <td>
            작은 Weight Group
          </td>

          <td>
            해당 Group만
          </td>

          <td>
            일반적으로 가장 유리함
          </td>

          <td>
            가장 많음
          </td>

        </tr>

      </tbody>

    </table>

  </div>


  <!-- =====================================================
       구조적 차이
       ===================================================== -->

  <div class="qg-subtitle">
    구조적 차이
  </div>


  <div class="qg-card-grid">


    <!-- ===================================================
         Per-Tensor
         =================================================== -->

    <div class="qg-card">

      <div class="qg-card-title">
        Per-Tensor
      </div>


      <p class="qg-card-desc">

        Tensor 전체가 하나의
        Scaling Factor를 공유함.

      </p>


      <div class="qg-structure">

        <div class="qg-box">

          <span class="qg-box-name">
            Weight Tensor
          </span>

          <span class="qg-scale">
            Scaling Factor = Δ
          </span>

        </div>

      </div>


      <div class="qg-card-point">

        <strong>
          Outlier 하나가 Tensor 전체에 영향을 줌.
        </strong>

        Scaling Factor 저장량은 가장 적지만,
        하나의 큰 값 때문에 Tensor 전체의
        Scaling Factor가 커질 수 있음.

        그 결과 작은 Weight를 정밀하게 표현하기
        어려워질 수 있음.

      </div>

    </div>



    <!-- ===================================================
         Per-Channel
         =================================================== -->

    <div class="qg-card">

      <div class="qg-card-title">
        Per-Channel
      </div>


      <p class="qg-card-desc">

        각 Output Channel마다 독립적인
        Scaling Factor를 사용함.

      </p>


      <div class="qg-structure">


        <div class="qg-box">

          <span class="qg-box-name">
            Channel 1
          </span>

          <span class="qg-scale">
            Δ₁
          </span>

        </div>


        <div class="qg-box">

          <span class="qg-box-name">
            Channel 2
          </span>

          <span class="qg-scale">
            Δ₂
          </span>

        </div>


        <div class="qg-box">

          <span class="qg-box-name">
            Channel 3
          </span>

          <span class="qg-scale">
            Δ₃
          </span>

        </div>


      </div>


      <div class="qg-card-point">

        <strong>
          Outlier의 영향을 해당 Channel 내부로 제한함.
        </strong>

        Per-Tensor보다 세밀한 Quantization이 가능하지만,
        동일한 Channel 내부의 Weight들은 여전히
        하나의 Scaling Factor를 공유함.

      </div>

    </div>



    <!-- ===================================================
         Per-Group
         =================================================== -->

    <div class="qg-card qg-card-group">


      <div class="qg-card-title">
        Per-Group
      </div>


      <p class="qg-card-desc">

        하나의 Channel을 다시 작은 Weight Group으로
        나누어 각각 독립적으로 양자화함.

      </p>


      <div class="qg-group-grid">


        <div class="qg-box">

          <span class="qg-box-name">
            Group 1
          </span>

          <span class="qg-scale">
            Δ₁
          </span>

        </div>


        <div class="qg-box">

          <span class="qg-box-name">
            Group 2
          </span>

          <span class="qg-scale">
            Δ₂
          </span>

        </div>


        <div class="qg-box">

          <span class="qg-box-name">
            Group 3
          </span>

          <span class="qg-scale">
            Δ₃
          </span>

        </div>


        <div class="qg-box">

          <span class="qg-box-name">
            Group 4
          </span>

          <span class="qg-scale">
            Δ₄
          </span>

        </div>


      </div>


      <div class="qg-card-point">

        <strong>
          Outlier의 영향을 해당 Group 내부로 제한함.
        </strong>

        각 Group의 Maximum Value와 Value Range를
        줄일 수 있어 더 작은 Scaling Factor를
        사용할 가능성이 높음.

        따라서 Quantization Error를 줄이는 데
        일반적으로 가장 유리함.

        단, Group별 Quantization Parameter를
        저장해야 하므로 Metadata가 증가함.

      </div>

    </div>


  </div>

</div>

### Quantization Data Type Matters

같은 4-bit 양자화라도 어떤 Data Type을 사용하느냐에 따라 Quantization Error와 모델 성능이 달라짐.

BitMoD 논문에서는 4-bit 기준으로 다음 Data Type을 비교함.

- INT4-Sym
- INT4-Asym
- FP4
- Flint

<style>
/* =========================================================
   BitMoD Table I 전용
   다른 Markdown / Table에는 전혀 영향을 주지 않음
   ========================================================= */

.bitmod-table1-grid {
  width: 100%;
  margin: 32px auto;

  font-family:
    "Times New Roman",
    Times,
    serif;

  color: inherit;
}


/* Caption */
.bitmod-table1-grid .bt1-caption {
  margin: 0 0 12px;

  font-family:
    "Times New Roman",
    Times,
    serif;

  font-size: 17px;
  line-height: 1.4;
}

.bitmod-table1-grid .bt1-number {
  margin-right: 10px;
  white-space: nowrap;
}


/* 모바일에서 가로 스크롤 */
.bitmod-table1-grid .bt1-scroll {
  width: 100%;
  overflow-x: auto;
}


/* 실제 표 영역 */
.bitmod-table1-grid .bt1-frame {
  min-width: 820px;

  border-top: 3px solid currentColor;
  border-bottom: 3px solid currentColor;
}


/* 모든 Row 공통 */
.bitmod-table1-grid .bt1-row {
  display: grid;

  grid-template-columns:
    1.35fr
    repeat(8, 0.9fr);

  align-items: stretch;
}


/* 모든 Cell 공통 */
.bitmod-table1-grid .bt1-cell {
  display: flex;

  align-items: center;
  justify-content: center;

  min-width: 0;

  padding: 5px 8px;

  font-family:
    "Times New Roman",
    Times,
    serif;

  font-size: 17px;
  line-height: 1.15;

  text-align: center;

  background: transparent;
}


/* =========================================================
   Header 1
   Model / OPT / Phi / Llama ...
   ========================================================= */

.bitmod-table1-grid .bt1-header-main {
  border-bottom: 1px solid currentColor;
}

.bitmod-table1-grid .bt1-header-main .bt1-cell {
  font-size: 17px;
}


/* 첫 번째 Model */
.bitmod-table1-grid .bt1-model {
  grid-column: 1;
}


/* 모델명은 두 개 열씩 차지 */
.bitmod-table1-grid .bt1-opt {
  grid-column: 2 / span 2;
}

.bitmod-table1-grid .bt1-phi {
  grid-column: 4 / span 2;
}

.bitmod-table1-grid .bt1-llama7 {
  grid-column: 6 / span 2;
}

.bitmod-table1-grid .bt1-llama13 {
  grid-column: 8 / span 2;
}


/* =========================================================
   Header 2
   Granularity / PC / PG
   ========================================================= */

.bitmod-table1-grid .bt1-header-sub {
  border-bottom: 3px solid currentColor;
}


/* =========================================================
   세로 구분선
   ========================================================= */

.bitmod-table1-grid .bt1-sep-right {
  border-right: 1px solid currentColor;
}


/* =========================================================
   Body
   ========================================================= */

.bitmod-table1-grid .bt1-body .bt1-cell {
  padding-top: 6px;
  padding-bottom: 6px;
}


/* 첫 번째 열 */
.bitmod-table1-grid .bt1-row-label {
  font-size: 17px;
}


/* 논문 Bold 값 */
.bitmod-table1-grid .bt1-best {
  font-weight: 700;
}


/* 모바일 */
@media (max-width: 760px) {

  .bitmod-table1-grid .bt1-caption {
    font-size: 15px;
  }

  .bitmod-table1-grid .bt1-cell {
    font-size: 15px;
  }

  .bitmod-table1-grid .bt1-row-label {
    font-size: 15px;
  }

}
</style>


<div class="bitmod-table1-grid">


  <!-- Caption -->
  <div class="bt1-caption">

    <span class="bt1-number">
      TABLE I.
    </span>

    Wikitext-2 perplexity (↓) under different quantization
    granularity and 4-bit data types. “PC” and “PG” stand for
    per-channel and per-group, respectively.
    The group size is 128.

  </div>


  <div class="bt1-scroll">

    <div class="bt1-frame">


      <!-- ==================================================
           Header 1
           ================================================== -->

      <div class="bt1-row bt1-header-main">

        <div class="bt1-cell bt1-model bt1-sep-right">
          Model
        </div>

        <div class="bt1-cell bt1-opt bt1-sep-right">
          OPT-1.3B
        </div>

        <div class="bt1-cell bt1-phi bt1-sep-right">
          Phi-2B
        </div>

        <div class="bt1-cell bt1-llama7 bt1-sep-right">
          Llama-2-7B
        </div>

        <div class="bt1-cell bt1-llama13">
          Llama-2-13B
        </div>

      </div>


      <!-- ==================================================
           Header 2
           ================================================== -->

      <div class="bt1-row bt1-header-sub">

        <div class="bt1-cell bt1-sep-right">
          Granularity
        </div>

        <div class="bt1-cell">
          PC
        </div>

        <div class="bt1-cell bt1-sep-right">
          PG
        </div>

        <div class="bt1-cell">
          PC
        </div>

        <div class="bt1-cell bt1-sep-right">
          PG
        </div>

        <div class="bt1-cell">
          PC
        </div>

        <div class="bt1-cell bt1-sep-right">
          PG
        </div>

        <div class="bt1-cell">
          PC
        </div>

        <div class="bt1-cell">
          PG
        </div>

      </div>


      <!-- ==================================================
           FP16
           ================================================== -->

      <div class="bt1-row bt1-body">

        <div class="bt1-cell bt1-row-label bt1-sep-right">
          FP16
        </div>

        <div class="bt1-cell">
          14.62
        </div>

        <div class="bt1-cell bt1-sep-right">
          14.62
        </div>

        <div class="bt1-cell">
          9.71
        </div>

        <div class="bt1-cell bt1-sep-right">
          9.71
        </div>

        <div class="bt1-cell">
          5.47
        </div>

        <div class="bt1-cell bt1-sep-right">
          5.47
        </div>

        <div class="bt1-cell">
          4.88
        </div>

        <div class="bt1-cell">
          4.88
        </div>

      </div>


      <!-- ==================================================
           INT4-Sym
           ================================================== -->

      <div class="bt1-row bt1-body">

        <div class="bt1-cell bt1-row-label bt1-sep-right">
          INT4-Sym
        </div>

        <div class="bt1-cell">
          36.05
        </div>

        <div class="bt1-cell bt1-sep-right">
          16.04
        </div>

        <div class="bt1-cell">
          13.03
        </div>

        <div class="bt1-cell bt1-sep-right">
          11.15
        </div>

        <div class="bt1-cell">
          12.92
        </div>

        <div class="bt1-cell bt1-sep-right">
          5.84
        </div>

        <div class="bt1-cell">
          5.47
        </div>

        <div class="bt1-cell">
          5.07
        </div>

      </div>


      <!-- ==================================================
           INT4-Asym
           ================================================== -->

      <div class="bt1-row bt1-body">

        <div class="bt1-cell bt1-row-label bt1-sep-right">
          INT4-Asym
        </div>

        <div class="bt1-cell">
          48.41
        </div>

        <div class="bt1-cell bt1-sep-right">
          15.41
        </div>

        <div class="bt1-cell">
          12.08
        </div>

        <div class="bt1-cell bt1-best bt1-sep-right">
          10.67
        </div>

        <div class="bt1-cell">
          8.89
        </div>

        <div class="bt1-cell bt1-best bt1-sep-right">
          5.77
        </div>

        <div class="bt1-cell">
          5.27
        </div>

        <div class="bt1-cell bt1-best">
          5.01
        </div>

      </div>


      <!-- ==================================================
           FP4
           ================================================== -->

      <div class="bt1-row bt1-body">

        <div class="bt1-cell bt1-row-label bt1-sep-right">
          FP4
        </div>

        <div class="bt1-cell">
          16.07
        </div>

        <div class="bt1-cell bt1-best bt1-sep-right">
          14.99
        </div>

        <div class="bt1-cell bt1-best">
          11.24
        </div>

        <div class="bt1-cell bt1-sep-right">
          10.68
        </div>

        <div class="bt1-cell">
          8.07
        </div>

        <div class="bt1-cell bt1-best bt1-sep-right">
          5.77
        </div>

        <div class="bt1-cell bt1-best">
          5.15
        </div>

        <div class="bt1-cell">
          5.05
        </div>

      </div>


      <!-- ==================================================
           Flint
           ================================================== -->

      <div class="bt1-row bt1-body">

        <div class="bt1-cell bt1-row-label bt1-sep-right">
          Flint
        </div>

        <div class="bt1-cell bt1-best">
          15.87
        </div>

        <div class="bt1-cell bt1-sep-right">
          16.23
        </div>

        <div class="bt1-cell">
          11.71
        </div>

        <div class="bt1-cell bt1-sep-right">
          11.23
        </div>

        <div class="bt1-cell bt1-best">
          6.67
        </div>

        <div class="bt1-cell bt1-sep-right">
          6.09
        </div>

        <div class="bt1-cell">
          5.31
        </div>

        <div class="bt1-cell">
          5.29
        </div>

      </div>


    </div>

  </div>

</div>

논문의 Table I에서 두 가지 중요한 결과를 확인할 수 있음.

1. **Per-Channel에서 좋은 Data Type이 Per-Group에서도 좋은 것은 아님**
   - ANT의 Flint는 Per-Channel에서는 좋은 성능을 보이지만, Per-Group에서는 INT4-Asym이나 FP4보다 좋은 결과를 내지 못함.
   - 즉, Per-Group Quantization에 적합한 Data Type을 별도로 설계할 필요가 있음.

2. **Per-Group에서는 FP와 Asymmetry가 모두 유리함**
   - INT4-Asym과 FP4가 여러 모델에서 좋은 Perplexity를 보임.
   - 이는 LLM Weight의 분포 특성 때문임.

#### 왜 FP가 유리한가?

LLM Weight는 일반적으로 0 근처에 값이 많이 모여 있는 **Gaussian-like Distribution**을 가짐.

<style>
/* BitMoD Weight Distribution 전용 */
.bitmod-gaussian-demo {
  --bg: rgba(127, 127, 127, 0.045);
  --border: rgba(127, 127, 127, 0.25);
  --axis: rgba(127, 127, 127, 0.55);
  --bar: #5b8cff;
  --bar-soft: rgba(91, 140, 255, 0.38);

  width: 100%;
  max-width: 760px;
  margin: 26px auto;
  padding: 28px 30px 24px;

  border: 1px solid var(--border);
  border-radius: 16px;

  background: var(--bg);

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Pretendard",
    "Segoe UI",
    sans-serif;

  box-sizing: border-box;
}

.bitmod-gaussian-demo *,
.bitmod-gaussian-demo *::before,
.bitmod-gaussian-demo *::after {
  box-sizing: border-box;
}


/* 설명 */
.bitmod-gaussian-demo .bgd-title {
  margin-bottom: 6px;

  font-size: 16px;
  font-weight: 700;
}

.bitmod-gaussian-demo .bgd-desc {
  margin-bottom: 26px;

  font-size: 14px;
  line-height: 1.6;

  opacity: 0.72;
}


/* 그래프 전체 */
.bitmod-gaussian-demo .bgd-chart {
  position: relative;

  height: 230px;

  padding:
    15px
    24px
    38px
    46px;
}


/* Y축 */
.bitmod-gaussian-demo .bgd-y-axis {
  position: absolute;

  top: 15px;
  bottom: 38px;
  left: 45px;

  width: 1px;

  background: var(--axis);
}


/* X축 */
.bitmod-gaussian-demo .bgd-x-axis {
  position: absolute;

  left: 45px;
  right: 24px;
  bottom: 38px;

  height: 1px;

  background: var(--axis);
}


/* 축 화살표 */
.bitmod-gaussian-demo .bgd-y-axis::before {
  content: "";

  position: absolute;

  top: -1px;
  left: -4px;

  width: 8px;
  height: 8px;

  border-top: 1.5px solid var(--axis);
  border-left: 1.5px solid var(--axis);

  transform: rotate(45deg);
}

.bitmod-gaussian-demo .bgd-x-axis::after {
  content: "";

  position: absolute;

  right: -1px;
  top: -4px;

  width: 8px;
  height: 8px;

  border-top: 1.5px solid var(--axis);
  border-right: 1.5px solid var(--axis);

  transform: rotate(45deg);
}


/* 축 Label */
.bitmod-gaussian-demo .bgd-y-label {
  position: absolute;

  top: -10px;
  left: 5px;

  font-size: 13px;
  font-weight: 650;

  opacity: 0.75;
}

.bitmod-gaussian-demo .bgd-x-label {
  position: absolute;

  right: 10px;
  bottom: 8px;

  font-size: 13px;
  font-weight: 650;

  opacity: 0.75;
}


/* 막대 영역 */
.bitmod-gaussian-demo .bgd-bars {
  position: absolute;

  left: 70px;
  right: 48px;
  bottom: 39px;

  height: 160px;

  display: flex;
  align-items: flex-end;
  justify-content: center;

  gap: 7px;
}


/* 각 막대 */
.bitmod-gaussian-demo .bgd-bar {
  flex: 1;

  max-width: 38px;
  min-width: 12px;

  border-radius: 5px 5px 1px 1px;

  background: var(--bar-soft);
}


/* 가운데 Weight 강조 */
.bitmod-gaussian-demo .bgd-bar.center {
  background: var(--bar);
}


/* 0 표시 */
.bitmod-gaussian-demo .bgd-zero {
  position: absolute;

  left: 50%;
  bottom: 9px;

  transform: translateX(-50%);

  font-family:
    "Times New Roman",
    Times,
    serif;

  font-size: 15px;
}


/* 하단 핵심 설명 */
.bitmod-gaussian-demo .bgd-note {
  margin-top: 8px;
  padding-top: 16px;

  border-top: 1px dashed var(--border);

  font-size: 14px;
  line-height: 1.7;
}

.bitmod-gaussian-demo .bgd-note strong {
  color: var(--bar);
}


@media (max-width: 600px) {

  .bitmod-gaussian-demo {
    padding: 22px 18px;
  }

  .bitmod-gaussian-demo .bgd-chart {
    height: 200px;
  }

  .bitmod-gaussian-demo .bgd-bars {
    height: 135px;
    gap: 4px;
  }

}
</style>


<div class="bitmod-gaussian-demo">

  <div class="bgd-title">
    LLM Weight의 Gaussian-like Distribution
  </div>

  <div class="bgd-desc">
    대부분의 Weight는 0 근처에 집중되어 있으며,
    절댓값이 큰 Weight는 상대적으로 적게 존재함.
  </div>


  <div class="bgd-chart">

    <div class="bgd-y-label">
      빈도
    </div>

    <div class="bgd-x-label">
      Weight
    </div>

    <div class="bgd-y-axis"></div>

    <div class="bgd-x-axis"></div>


    <div class="bgd-bars">

      <div class="bgd-bar" style="height: 12%;"></div>

      <div class="bgd-bar" style="height: 22%;"></div>

      <div class="bgd-bar" style="height: 38%;"></div>

      <div class="bgd-bar" style="height: 62%;"></div>

      <div class="bgd-bar" style="height: 84%;"></div>

      <div class="bgd-bar center" style="height: 100%;"></div>

      <div class="bgd-bar" style="height: 84%;"></div>

      <div class="bgd-bar" style="height: 62%;"></div>

      <div class="bgd-bar" style="height: 38%;"></div>

      <div class="bgd-bar" style="height: 22%;"></div>

      <div class="bgd-bar" style="height: 12%;"></div>

    </div>


    <div class="bgd-zero">
      0
    </div>

  </div>


  <div class="bgd-note">

    이러한 분포에서는 <strong>0 근처의 작은 값을 세밀하게 표현하는 것이 중요함.</strong>
    Floating Point는 작은 값 영역에 상대적으로 많은 표현 Level을 사용할 수 있기 때문에
    LLM Weight의 Gaussian-like Distribution에 적합함.

  </div>

</div>

Floating Point는 작은 값 주변을 상대적으로 세밀하게 표현할 수 있으므로 이러한 분포에 잘 맞음.

#### 왜 Asymmetry가 필요한가?

Per-Group으로 Weight를 나누더라도 특정 Group에서는 Outlier가 양수 또는 음수 한쪽에만 존재할 수 있음.

```text
[-0.4, -0.2, 0.1, 0.3, 0.7, 5.0]
                              ↑
                        Positive Outlier
```

이 경우 대칭적인 Data Type을 사용하면 반대 방향의 표현 범위가 낭비될 수 있으므로 Asymmetric한 표현이 유리함.

따라서 BitMoD는 다음 두 가지 장점을 결합하고자 함.

<style>
/* =========================================================
   BitMoD Data Type Motivation 전용 스타일
   다른 Markdown 영역에는 영향 없음
   ========================================================= */

.bitmod-dtype-flow {
  --bd-accent: #5b8cff;
  --bd-border: rgba(127, 127, 127, 0.28);
  --bd-card-bg: rgba(127, 127, 127, 0.045);
  --bd-accent-bg: rgba(91, 140, 255, 0.10);

  width: 100%;
  margin: 28px 0;

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Pretendard",
    "Segoe UI",
    sans-serif;

  box-sizing: border-box;
}

.bitmod-dtype-flow *,
.bitmod-dtype-flow *::before,
.bitmod-dtype-flow *::after {
  box-sizing: border-box;
}


/* 상단 2개 카드 */
.bitmod-dtype-flow .bd-source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 18px;
}


/* 카드 공통 */
.bitmod-dtype-flow .bd-card {
  position: relative;

  padding: 22px 24px;

  border: 1px solid var(--bd-border);
  border-radius: 15px;

  background: var(--bd-card-bg);
}


/* 카드 제목 */
.bitmod-dtype-flow .bd-card-title {
  display: flex;
  align-items: center;
  gap: 9px;

  margin-bottom: 8px;

  font-size: 18px;
  font-weight: 750;
}


/* 번호 Badge */
.bitmod-dtype-flow .bd-badge {
  display: inline-flex;

  width: 28px;
  height: 28px;

  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: var(--bd-accent-bg);
  color: var(--bd-accent);

  font-size: 13px;
  font-weight: 750;
}


/* 설명 */
.bitmod-dtype-flow .bd-card-desc {
  margin: 0;

  font-size: 14px;
  line-height: 1.7;

  opacity: 0.78;
}


/* 핵심 키워드 */
.bitmod-dtype-flow .bd-keyword {
  display: inline-block;

  margin-top: 14px;
  padding: 6px 10px;

  border-radius: 7px;

  background: var(--bd-accent-bg);
  color: var(--bd-accent);

  font-size: 13px;
  font-weight: 700;
}


/* 중앙 Merge */
.bitmod-dtype-flow .bd-merge {
  display: flex;
  flex-direction: column;

  align-items: center;

  margin: 8px 0;
}


/* 위에서 내려오는 선 */
.bitmod-dtype-flow .bd-merge-line {
  width: 1px;
  height: 30px;

  background: var(--bd-border);
}


/* Plus Circle */
.bitmod-dtype-flow .bd-plus {
  display: flex;

  width: 38px;
  height: 38px;

  align-items: center;
  justify-content: center;

  border: 1px solid var(--bd-border);
  border-radius: 50%;

  background: var(--bd-card-bg);

  font-size: 20px;
  font-weight: 650;
}


/* 아래 화살표 */
.bitmod-dtype-flow .bd-down {
  position: relative;

  width: 1px;
  height: 32px;

  background: var(--bd-border);
}

.bitmod-dtype-flow .bd-down::after {
  content: "";

  position: absolute;

  bottom: 0;
  left: -4px;

  width: 9px;
  height: 9px;

  border-right: 1.5px solid var(--bd-border);
  border-bottom: 1.5px solid var(--bd-border);

  transform: rotate(45deg);
}


/* 결과 카드 */
.bitmod-dtype-flow .bd-result {
  margin-top: 2px;

  padding: 24px 26px;

  border: 1.5px solid rgba(91, 140, 255, 0.65);
  border-radius: 16px;

  background: var(--bd-accent-bg);

  text-align: center;
}


/* 결과 제목 */
.bitmod-dtype-flow .bd-result-title {
  margin-bottom: 8px;

  color: var(--bd-accent);

  font-size: 20px;
  font-weight: 800;
}


/* 결과 설명 */
.bitmod-dtype-flow .bd-result-desc {
  margin: 0 auto;

  max-width: 720px;

  font-size: 14px;
  line-height: 1.75;

  opacity: 0.82;
}


/* 모바일 */
@media (max-width: 700px) {

  .bitmod-dtype-flow .bd-source-grid {
    grid-template-columns: 1fr;
  }

}
</style>


<div class="bitmod-dtype-flow">

  <div class="bd-source-grid">


    <!-- Floating Point -->
    <div class="bd-card">

      <div class="bd-card-title">

        <span class="bd-badge">
          1
        </span>

        Floating Point

      </div>

      <p class="bd-card-desc">
        LLM Weight는 일반적으로 0 주변에 값이 많이 집중되는
        Gaussian-like Distribution을 가지므로,
        작은 값을 상대적으로 세밀하게 표현할 수 있는
        Floating Point가 유리함.
      </p>

      <span class="bd-keyword">
        Gaussian-like Distribution
      </span>

    </div>


    <!-- Asymmetry -->
    <div class="bd-card">

      <div class="bd-card-title">

        <span class="bd-badge">
          2
        </span>

        Asymmetry

      </div>

      <p class="bd-card-desc">
        Per-Group Quantization을 사용하더라도
        특정 Weight Group에서는 Positive 또는 Negative Outlier가
        한쪽에만 존재할 수 있으므로,
        비대칭적인 표현 범위가 유리함.
      </p>

      <span class="bd-keyword">
        Asymmetric Outlier
      </span>

    </div>

  </div>


  <!-- Merge -->
  <div class="bd-merge">

    <div class="bd-merge-line"></div>

    <div class="bd-plus">
      +
    </div>

    <div class="bd-down"></div>

  </div>


  <!-- Result -->
  <div class="bd-result">

    <div class="bd-result-title">
      BitMoD Data Type
    </div>

    <p class="bd-result-desc">
      Floating Point의 Gaussian-like Distribution 표현 능력과
      Asymmetric Quantization의 비대칭 Outlier 대응 능력을 결합하여,
      각 Weight Group의 분포에 더 잘 적응하는 저정밀 Data Type을 구성함.
    </p>

  </div>

</div>

#### Redundant Zero 활용

저정밀 Floating Point는 Sign-Magnitude 표현 때문에 `+0`과 `-0`을 모두 가질 수 있음.

예를 들어 기본 FP3의 고유한 값은 다음과 같음.

```text
0, ±1, ±2, ±4
```

3-bit는 총 8개의 Bit Pattern을 표현할 수 있지만 `+0`과 `-0`이 동일한 값 0을 나타내기 때문에 하나의 표현 공간이 낭비됨.

$$
\frac{1}{8}=12.5\%
$$

즉, FP3에서는 전체 표현 공간의 12.5%가 중복된 Zero에 사용되는 셈임.

BitMoD는 이 중복된 Zero를 다른 **Special Value**로 교체함.

```text
기본 FP3

0, ±1, ±2, ±4

        ↓

중복 Zero를 Special Value로 변경

        ↓

0, ±1, ±2, ±4, +6
또는
0, ±1, ±2, ±4, -6
```

이를 통해 제한된 Quantization Level을 모두 활용하면서, 각 Weight Group의 분포에 맞춰 추가적인 Resolution이나 Asymmetry를 제공할 수 있음.

> 핵심적으로 BitMoD는 **FP의 Gaussian-like 분포 표현 능력과 Asymmetric Quantization의 비대칭 분포 대응 능력을 결합하고, 이를 위해 저정밀 FP에서 낭비되는 중복 Zero를 Special Value로 재사용하는 방식**임.

### Quantization Bit-width Matters

기존 LLM Accelerator는 주로 **8-bit와 4-bit 정밀도**를 지원하는 Bit-Parallel 구조를 사용함.

하지만 BitMoD에서는 8-bit와 4-bit 사이의 **6-bit 역시 중요한 선택지**라고 봄. 실제 실험 결과, 6-bit Weight Quantization은 FP16과 비교해도 Perplexity 차이가 거의 발생하지 않음.

#### 6-bit Quantization 결과

논문에서는 Group Size 128의 Per-Group Quantization 환경에서 다음 6-bit Data Type을 비교함.

- **INT6-Sym**: 6-bit Symmetric Integer
- **INT6-Asym**: 6-bit Asymmetric Integer
- **FP6-E2M3**: Sign 1-bit + Exponent 2-bit + Mantissa 3-bit
- **FP6-E3M2**: Sign 1-bit + Exponent 3-bit + Mantissa 2-bit

예를 들어 Llama-2-7B의 Wikitext-2 Perplexity는 다음과 같음.

| Data Type | Perplexity |
|---|---:|
| FP16 | 5.47 |
| INT6-Sym | 5.49 |
| INT6-Asym | 5.49 |
| FP6-E2M3 | 5.52 |
| FP6-E3M2 | 5.49 |

6-bit를 사용해도 FP16과 거의 동일한 성능을 유지하고 있으며, 특히 **INT6-Sym의 평균 Perplexity 손실은 0.05 미만**임.

즉, 무조건 8-bit나 4-bit만 사용하는 것보다 모델과 작업에 따라 다양한 Bit-width를 선택하는 것이 더 좋은 Accuracy-Efficiency Trade-off를 제공할 수 있음.

```text
높은 정확도가 중요함
→ 6-bit

더 높은 압축률이 필요함
→ 4-bit

Memory Footprint를 최대한 줄이고 싶음
→ 3-bit
```

#### 왜 다양한 Bit-width 지원이 필요한가?

Bit-width가 낮아질수록 Weight 저장 공간과 Memory Access는 감소하지만 Quantization Error는 증가할 가능성이 높음.

반대로 Bit-width가 높으면 Accuracy는 유지하기 쉽지만 Memory Footprint와 연산 비용이 증가함.

따라서 중요한 것은 **하나의 Precision만 고정적으로 사용하는 것이 아니라, Accuracy와 Hardware Efficiency에 따라 적절한 Precision을 선택할 수 있도록 하는 것**임.

```text
Bit-width ↑
→ Accuracy 유지에 유리함
→ Memory / Computation Cost 증가

Bit-width ↓
→ Memory / Computation Cost 감소
→ Quantization Error 증가 가능
```

#### Bit-Serial Architecture

다양한 Bit-width를 지원하기 위한 자연스러운 방법으로 **Bit-Serial Architecture**를 사용할 수 있음.

기존 Bit-Parallel 구조는 특정 Precision에 맞춰 Hardware가 구성되기 때문에 8-bit와 4-bit는 효율적으로 처리할 수 있지만 6-bit나 3-bit를 유연하게 지원하기 어려움.

반면 Bit-Serial 방식은 Weight를 여러 Bit 단위 Term으로 나누어 처리하기 때문에 Precision에 따라 처리해야 하는 Term의 수를 조절할 수 있음.

```text
8-bit → 많은 Bit-Serial Term 처리
6-bit → 더 적은 Term 처리
4-bit → 더 적은 Term 처리
3-bit → 가장 적은 Term 처리
```

따라서 하나의 Hardware Structure에서 다양한 Bit-width를 지원하기에 적합함.

#### 기존 Bit-Serial Accelerator의 한계

하지만 기존 Bit-Serial Accelerator에도 두 가지 문제가 존재함.

**1. 주로 Integer Data Type만 지원함**

기존 Bit-Serial Accelerator는 주로 Integer 연산을 대상으로 설계되어 있어, 3-bit처럼 매우 낮은 Precision에서는 큰 Accuracy Loss가 발생할 수 있음.

앞의 `Quantization Data Type Matters`에서 확인했듯이 매우 낮은 Bit-width에서는 단순 Integer보다 Weight Distribution에 적합한 Data Type이 필요함.

**2. Per-Group Quantization 지원이 어려움**

Per-Group Quantization에서는 각 Group마다 서로 다른 Scaling Factor를 사용함.

```text
Group 1 → Δ₁
Group 2 → Δ₂
Group 3 → Δ₃
```

따라서 각 Group의 Dot-Product를 계산한 뒤 해당 Group의 Scaling Factor를 적용하여 Partial Sum을 Dequantization해야 함.

```text
Group Dot-Product
      ↓
Scaling Factor 적용
      ↓
Dequantized Partial Sum
```

기존 방식에서는 Scaling Factor가 Floating Point이므로 이를 처리하기 위해 별도의 Floating-Point Unit이 필요하며, 이는 큰 Hardware Area Overhead를 발생시킴.

따라서 BitMoD에서는 **다양한 Bit-width와 Data Type을 지원하는 Bit-Serial 구조**와 함께, **Per-Group Quantization을 낮은 Hardware Cost로 처리할 수 있는 Dequantization 방식**이 필요함.

### Algorithm-Hardware Co-Design Matters

좋은 Quantization Algorithm만 설계한다고 해서 실제 LLM 실행이 반드시 효율적인 것은 아님.  
Quantization 방식과 이를 처리하는 Hardware를 함께 고려해야 실제 Accuracy와 Hardware Efficiency를 모두 확보할 수 있음.

#### 기존 방식의 문제점

**1. AWQ — Accuracy는 높지만 Hardware Efficiency가 낮음**

AWQ는 LLM Weight를 저정밀 Integer로 양자화하면서 높은 Accuracy를 유지함.

하지만 일반 GPU는 다음과 같은 Mixed-Precision 연산을 직접 효율적으로 처리하기 어려움.

$$
\text{Low-Precision Weight} \times \text{FP16 Activation}
$$

따라서 실제 연산에서는 저정밀 Weight를 다시 FP16으로 Dequantization한 후 GPU의 Floating-Point Pipeline을 사용함.

```text
INT4 Weight
    ↓
FP16으로 Dequantization
    ↓
FP16 Weight × FP16 Activation
    ↓
GPU Floating-Point Pipeline
```

즉, Weight를 낮은 Precision으로 저장하여 Memory 사용량은 줄일 수 있지만, **저정밀 Weight의 장점을 실제 연산 효율로 충분히 연결하지 못함.**

**2. ANT / OliVe / FIGNA — Hardware는 효율적이지만 지원 범위가 제한적임**

ANT, OliVe, FIGNA는 Quantized Model을 직접 처리할 수 있는 Dedicated Accelerator를 사용하기 때문에 Hardware Efficiency가 높음.

하지만 주로 **8-bit와 4-bit Precision만 지원**하므로 6-bit처럼 Accuracy와 Efficiency 사이에서 좋은 선택이 될 수 있는 다른 Precision을 활용하기 어려움.

```text
8-bit  → 지원

6-bit  → 지원하기 어려움

4-bit  → 지원
```

또한 이러한 Accelerator들은 **Per-Group Quantization을 기본적으로 지원하지 않음.**

#### Per-Group Quantization이 Hardware에서 어려운 이유

Per-Group Quantization에서는 각 Weight Group마다 서로 다른 Scaling Factor를 사용함.

```text
Group 1 → Δ₁
Group 2 → Δ₂
Group 3 → Δ₃
```

따라서 각 Group의 Dot-Product 결과에 해당 Scaling Factor를 적용해야 함.

$$
P_1\Delta_1 + P_2\Delta_2 + P_3\Delta_3
$$

즉,

```text
Group Dot-Product
       ↓
Partial Sum
       ↓
Scaling Factor 적용
       ↓
Dequantization
```

과정이 모든 Group마다 필요함.

Scaling Factor는 Floating-Point 값이므로 기존 방식에서는 이를 처리하기 위한 **Floating-Point Unit**이 추가로 필요하며, 이로 인해 Hardware Area와 Energy Cost가 증가함.

#### Microscaling의 한계

Microscaling은 다양한 Bit-width와 Per-Group 형태를 지원할 수 있음.

하지만 Weight Group이 공유하는 Micro-Exponent를 처리하기 위해 Floating-Point Pipeline이 필요하므로 다른 저정밀 연산 방식보다 Energy Consumption이 증가함.

즉,

```text
다양한 Precision 지원
        +
Per-Group 지원
        ↓
하지만 FP Pipeline 필요
        ↓
Hardware / Energy Cost 증가
```

라는 Trade-off가 존재함.

#### 왜 Sub-4-bit가 필요한가?

LLM의 Weight가 차지하는 Memory Footprint가 매우 크기 때문에 4-bit보다 더 낮은 Precision을 사용하는 것도 중요함.

3-bit까지 Weight Precision을 낮출 수 있다면 Memory Footprint와 Memory Traffic을 더욱 줄일 수 있음.

하지만 기존 ANT, OliVe, Microscaling의 Data Type은 Per-Group 환경에서 3-bit까지 낮출 경우 큰 Accuracy Loss가 발생함.

따라서 **3-bit와 같은 매우 낮은 Precision에서도 Accuracy를 유지할 수 있는 새로운 Data Type과 Hardware가 필요함.**

#### 기존 방식 비교

| Framework | Per-Group | 다양한 Precision | 3-bit Accuracy | Hardware Efficiency |
|---|---|---|---|---|
| AWQ | O | 제한적 | 높음 | 낮음 |
| FIGNA | X | 제한적 | 낮음 | 높음 |
| ANT | X | 제한적 | 낮음 | 높음 |
| OliVe | X | 제한적 | 중간 | 높음 |
| Microscaling | O | O | 낮음 | 중간 |
| **BitMoD** | **O** | **O** | **높음** | **높음** |

기존 방식들은 Accuracy 또는 Hardware Efficiency 중 한쪽에서는 장점이 있지만, 두 가지를 동시에 만족시키는 데 한계가 있음.

# ◼︎ BitMoD Quatization Framework

## A. Asymmetric FP3 and FP4 Data Types

BitMoD는 **기본 Floating-Point에서 중복되는 Zero를 새로운 Special Value로 바꾸어**, 제한된 Bit 수를 더 효율적으로 활용하는 새로운 FP3/FP4 Data Type을 제안함.

기본 Floating-Point는 Sign-Magnitude 표현을 사용하기 때문에 `+0`과 `-0`이 서로 다른 Bit Pattern을 가지지만 실제 값은 모두 0임.

특히 3-bit에서는 총 8개의 Bit Pattern밖에 없기 때문에 하나의 중복된 Zero가 차지하는 비중이 큼.

$$
2^3 = 8
$$

기본 FP3의 실제 고유한 값은 다음 7개임.

$$
\{0,\pm1,\pm2,\pm4\}
$$

```text
3-bit → 총 8개의 Bit Pattern

하지만

+0 = 0
-0 = 0

→ 실제 고유한 값은 7개
→ 하나의 Quantization Level이 낭비됨
```

BitMoD는 이 **Redundant Zero를 다른 Special Value로 교체**하여 8개의 Quantization Level을 모두 활용함.

### FP3 Extension

기본 FP3는 다음 값을 표현함.

$$
\{0,\pm1,\pm2,\pm4\}
$$

BitMoD는 여기에 Weight Group의 분포에 따라 하나의 Special Value를 추가함.

즉, **Weight Group마다 Quantization Error를 줄일 수 있는 Special Value를 선택하여 기존 FP3를 확장하는 방식**임.

### Special Value를 Low-Precision Integer로 제한

이론적으로 Special Value는 FP16과 같은 임의의 값을 사용할 수도 있음.

하지만 복잡한 High-Precision 값을 사용하면 이를 처리하기 위한 Hardware가 추가로 필요하여 저정밀 Quantization의 장점이 줄어듦.

따라서 BitMoD는 Special Value를 **Hardware-Friendly한 Low-Precision Integer로 제한함.**

또한 Special Value 후보가 너무 많으면 어떤 값을 사용했는지 저장하기 위한 Metadata와 Hardware MUX가 증가함.

Special Value 후보의 개수를 $N$이라고 하면 필요한 Encoding Bit는

$$
\lceil \log_2 N \rceil
$$

임.

BitMoD는

$$
N=4
$$

로 설정하여 **Weight Group당 2-bit의 Metadata만 사용함.**

BitMoD는 Weight Group의 서로 다른 분포에 대응하기 위해 Special Value를 두 가지 목적으로 설계함.

#### 1. Extended Resolution (ER)

첫 번째 방법은 **기존 FP 범위 안에 새로운 값을 추가하는 것**임.

FP3의 기존 범위는

$$
[-4,+4]
$$

이므로 `±3`을 추가함.

```text
Basic FP3

-4    -2    -1     0    +1    +2          +4


FP3-ER (+3)

-4    -2    -1     0    +1    +2    +3    +4
                                      ↑
                               Special Value
```

최대 표현 범위는 그대로 유지하면서 기존에 없던 Quantization Level을 추가하므로 **값을 더 세밀하게 표현할 수 있음.**

이를 **FP3-ER (Extended Resolution)**이라고 함.

$$
\boxed{\text{FP3-ER Special Value} = \pm3}
$$

ER은 특히 **대칭적이고 Gaussian-like한 Weight Group**을 표현하는 데 유리함.

#### 2. Extended Asymmetry (EA)

두 번째 방법은 **기존 FP 범위 밖에 새로운 값을 추가하는 것**임.

예를 들어 `+6`을 추가하면

```text
Basic FP3

-4    -2    -1    0    +1    +2    +4


FP3-EA (+6)

-4    -2    -1    0    +1    +2    +4         +6
                                               ↑
                                        Special Value
```

Negative 방향은 `-4`까지지만 Positive 방향은 `+6`까지 표현할 수 있으므로 Data Type 자체가 비대칭적으로 변함.

```text
Negative Range → -4
Positive Range → +6
```

따라서 한쪽 방향에 Outlier가 존재하는 **Asymmetric Weight Group을 표현하는 데 유리함.**

Figure 3의 실험에서 여러 후보를 비교한 결과, `±6`이 대부분의 LLM에서 가장 낮은 Quantization Error를 보여 최종 Special Value로 선택됨.

이를 **FP3-EA (Extended Asymmetry)**라고 함.

$$
\boxed{\text{FP3-EA Special Value} = \pm6}
$$

### ER과 EA의 차이

두 방식의 목적은 서로 다름.

| Type | Special Value | Range 변화 | 목적 |
|---|---:|---|---|
| **FP3-ER** | ±3 | 기존 Range 유지 | Quantization Resolution 증가 |
| **FP3-EA** | ±6 | 한쪽 Range 확장 | Asymmetric Outlier 표현 |

즉, **ER은 표현 범위를 더 촘촘하게 만들고, EA는 한쪽 표현 범위를 더 넓히는 방식**임.

### FP4 Extension

BitMoD는 FP3에 사용한 동일한 아이디어를 FP4에도 적용함.

기본 FP4 값은 다음과 같음.

$$
\{0,\pm0.5,\pm1,\pm1.5,\pm2,\pm3,\pm4,\pm6\}
$$

실험을 통해 가장 적합한 Special Value를 찾은 결과,

- **FP4-ER → ±5**
- **FP4-EA → ±8**

을 사용함.

| Basic Dtype | Extended Dtype | Special Value | 역할 |
|---|---|---:|---|
| FP3 | **FP3-ER** | -3 or +3 | Resolution 확장 |
| FP3 | **FP3-EA** | -6 or +6 | Asymmetry 확장 |
| FP4 | **FP4-ER** | -5 or +5 | Resolution 확장 |
| FP4 | **FP4-EA** | -8 or +8 | Asymmetry 확장 |

최종적으로 BitMoD는 Weight Group마다 다음과 같은 후보 중 적절한 Special Value를 선택할 수 있음.

## B. Fine-grained Data Type Adaptation

앞의 `Asymmetric FP3 and FP4 Data Types`에서는 FP3와 FP4에 사용할 **4개의 Special Value 후보**를 정의했음.

| Precision | Basic Values | Special Values |
|---|---|---|
| FP3 | $\{0,\pm1,\pm2,\pm4\}$ | $\{-3,+3,-6,+6\}$ |
| FP4 | $\{0,\pm0.5,\pm1,\pm1.5,\pm2,\pm3,\pm4,\pm6\}$ | $\{-5,+5,-8,+8\}$ |

하지만 하나의 Weight Group에서는 **4개의 Special Value를 모두 사용하는 것이 아니라 하나만 선택하여 사용함.**

BitMoD는 모든 Weight Group에 동일한 Data Type을 적용하지 않고, **각 Weight Group마다 Quantization Error가 가장 작은 Special Value를 선택함.**

이를 **Fine-grained Data Type Adaptation**이라고 함.


즉, Scaling Factor만 Group마다 달라지는 것이 아니라 **Quantization에 사용하는 Data Type 자체도 Group의 Weight Distribution에 맞게 달라지는 방식**임.

<style>
/* =========================================================
   BitMoD Algorithm 1
   LaTeX / IEEE Paper 스타일
   이 Algorithm에만 적용됨
   ========================================================= */

.bitmod-algo1 {
  --algo-line: rgba(180, 185, 195, 0.75);
  --algo-line-soft: rgba(180, 185, 195, 0.28);
  --algo-muted: rgba(180, 185, 195, 0.72);

  width: 100%;
  max-width: 900px;

  margin: 30px auto 34px;

  font-family:
    "Times New Roman",
    Times,
    serif;

  color: inherit;

  box-sizing: border-box;
}

.bitmod-algo1 *,
.bitmod-algo1 *::before,
.bitmod-algo1 *::after {
  box-sizing: border-box;
}


/* =========================================================
   Algorithm 전체 Frame
   ========================================================= */

.bitmod-algo1 .algo-frame {
  width: 100%;

  border-top: 3px solid var(--algo-line);
  border-bottom: 3px solid var(--algo-line);

  padding: 0;
}


/* =========================================================
   Algorithm Caption
   ========================================================= */

.bitmod-algo1 .algo-caption {
  padding: 9px 8px 8px;

  border-bottom: 1px solid var(--algo-line);

  font-size: 18px;
  line-height: 1.35;
}

.bitmod-algo1 .algo-caption strong {
  font-weight: 700;
}


/* =========================================================
   Input / Output
   ========================================================= */

.bitmod-algo1 .algo-io {
  padding: 10px 8px 11px;

  border-bottom: 1px solid var(--algo-line);

  font-size: 16px;
  line-height: 1.65;
}

.bitmod-algo1 .algo-io-row {
  display: grid;

  grid-template-columns: 72px 1fr;

  gap: 5px;
}

.bitmod-algo1 .algo-io-label {
  font-weight: 700;
}


/* =========================================================
   Algorithm Body
   ========================================================= */

.bitmod-algo1 .algo-body {
  padding: 10px 0 11px;
}


/* 한 줄 */
.bitmod-algo1 .algo-row {
  display: grid;

  grid-template-columns: 42px 1fr;

  min-height: 30px;

  align-items: baseline;

  font-size: 16px;
  line-height: 1.55;
}


/* Line Number */
.bitmod-algo1 .algo-ln {
  padding-right: 12px;

  text-align: right;

  color: var(--algo-muted);

  font-size: 14px;
  font-variant-numeric: tabular-nums;

  user-select: none;
}


/* 실제 Algorithm 내용 */
.bitmod-algo1 .algo-code {
  padding-left: 8px;

  white-space: nowrap;
}


/* Keyword */
.bitmod-algo1 .algo-kw {
  font-weight: 700;
}


/* Function */
.bitmod-algo1 .algo-func {
  font-variant: small-caps;
}


/* Comment */
.bitmod-algo1 .algo-comment {
  color: var(--algo-muted);

  font-style: italic;
}


/* =========================================================
   들여쓰기
   ========================================================= */

.bitmod-algo1 .indent-1 {
  padding-left: 28px;
}

.bitmod-algo1 .indent-2 {
  padding-left: 56px;
}

.bitmod-algo1 .indent-3 {
  padding-left: 84px;
}


/* =========================================================
   Section Comment
   ========================================================= */

.bitmod-algo1 .algo-section {
  margin: 5px 0 3px;
}

.bitmod-algo1 .algo-section .algo-code {
  color: var(--algo-muted);

  font-style: italic;
}


/* =========================================================
   수학 기호
   ========================================================= */

.bitmod-algo1 .algo-math {
  font-family:
    "Times New Roman",
    Times,
    serif;

  font-style: italic;
}


/* =========================================================
   모바일
   ========================================================= */

@media (max-width: 700px) {

  .bitmod-algo1 {
    overflow-x: auto;
  }

  .bitmod-algo1 .algo-frame {
    min-width: 690px;
  }

  .bitmod-algo1 .algo-caption {
    font-size: 16px;
  }

  .bitmod-algo1 .algo-io,
  .bitmod-algo1 .algo-row {
    font-size: 15px;
  }

}
</style>


<div class="bitmod-algo1">

  <div class="algo-frame">


    <!-- Algorithm Caption -->
    <div class="algo-caption">
      <strong>Algorithm 1:</strong>
      Fine-grained data type adaptation
    </div>


    <!-- Input / Output -->
    <div class="algo-io">

      <div class="algo-io-row">

        <div class="algo-io-label">
          Input:
        </div>

        <div>
          Weight group:
          <span class="algo-math">W</span>;
          Quantization precision:
          <span class="algo-math">p</span>
        </div>

      </div>


      <div class="algo-io-row">

        <div class="algo-io-label">
          Output:
        </div>

        <div>
          Quantized weight group:
          <span class="algo-math">W<sub>qout</sub></span>;
          Selected special value:
          <span class="algo-math">v<sub>out</sub></span>
        </div>

      </div>

    </div>


    <!-- Algorithm Body -->
    <div class="algo-body">


      <!-- Line 1 -->
      <div class="algo-row">

        <div class="algo-ln">1</div>

        <div class="algo-code">

          <span class="algo-kw">Func</span>
          <span class="algo-func">
            AdaptiveQuant
          </span>(
          <span class="algo-math">W</span>,
          <span class="algo-math">p</span>
          ):

        </div>

      </div>


      <!-- Comment -->
      <div class="algo-row algo-section">

        <div class="algo-ln"></div>

        <div class="algo-code indent-1 algo-comment">
          // Get basic and special quantization values according to Table IV
        </div>

      </div>


      <!-- Line 2 -->
      <div class="algo-row">

        <div class="algo-ln">2</div>

        <div class="algo-code indent-1">

          basicValues =
          GetBasicValues(
          <span class="algo-math">p</span>
          )

        </div>

      </div>


      <!-- Line 3 -->
      <div class="algo-row">

        <div class="algo-ln">3</div>

        <div class="algo-code indent-1">

          specialValues =
          GetSpecialValues(
          <span class="algo-math">p</span>
          )

        </div>

      </div>


      <!-- Comment -->
      <div class="algo-row algo-section">

        <div class="algo-ln"></div>

        <div class="algo-code indent-1 algo-comment">
          // Search for the best special value
        </div>

      </div>


      <!-- Line 4 -->
      <div class="algo-row">

        <div class="algo-ln">4</div>

        <div class="algo-code indent-1">

          minError = +∞

        </div>

      </div>


      <!-- Line 5 -->
      <div class="algo-row">

        <div class="algo-ln">5</div>

        <div class="algo-code indent-1">

          <span class="algo-kw">for</span>
          <span class="algo-math">v</span>
          <span class="algo-kw">in</span>
          specialValues
          <span class="algo-kw">do</span>

        </div>

      </div>


      <!-- Line 6 -->
      <div class="algo-row">

        <div class="algo-ln">6</div>

        <div class="algo-code indent-2">

          quantValues =
          basicValues ∪
          <span class="algo-math">v</span>

        </div>

      </div>


      <!-- Line 7 -->
      <div class="algo-row">

        <div class="algo-ln">7</div>

        <div class="algo-code indent-2">

          <span class="algo-math">W<sub>q</sub></span>
          =
          NonLinearQuantize(
          <span class="algo-math">W</span>,
          quantValues
          )

        </div>

      </div>


      <!-- Line 8 -->
      <div class="algo-row">

        <div class="algo-ln">8</div>

        <div class="algo-code indent-2">

          newError =
          MeanSquareError(
          <span class="algo-math">W</span>,
          <span class="algo-math">W<sub>q</sub></span>
          )

        </div>

      </div>


      <!-- Line 9 -->
      <div class="algo-row">

        <div class="algo-ln">9</div>

        <div class="algo-code indent-2">

          <span class="algo-kw">if</span>
          newError &lt; minError
          <span class="algo-kw">then</span>

        </div>

      </div>


      <!-- Line 10 -->
      <div class="algo-row">

        <div class="algo-ln">10</div>

        <div class="algo-code indent-3">

          minError = newError

        </div>

      </div>


      <!-- Line 11 -->
      <div class="algo-row">

        <div class="algo-ln">11</div>

        <div class="algo-code indent-3">

          <span class="algo-math">
            W<sub>qout</sub>
          </span>
          =
          <span class="algo-math">
            W<sub>q</sub>
          </span>

        </div>

      </div>


      <!-- Line 12 -->
      <div class="algo-row">

        <div class="algo-ln">12</div>

        <div class="algo-code indent-3">

          <span class="algo-math">
            v<sub>out</sub>
          </span>
          =
          <span class="algo-math">
            v
          </span>

        </div>

      </div>


      <!-- Line 13 -->
      <div class="algo-row">

        <div class="algo-ln">13</div>

        <div class="algo-code indent-1">

          <span class="algo-kw">
            return
          </span>

          <span class="algo-math">
            W<sub>qout</sub>
          </span>,

          <span class="algo-math">
            v<sub>out</sub>
          </span>

        </div>

      </div>


    </div>

  </div>

</div>

<style>
/* =========================================================
   BitMoD Algorithm 1 Explanation
   Minimal / Paper Review Style
   이 영역에만 적용됨
   ========================================================= */
.bitmod-algo-explain {
  --bae-accent: #8fa6c9;
  --bae-border: rgba(170, 175, 185, 0.18);
  --bae-code-bg: rgba(127, 127, 127, 0.035);

  width: 100%;
  max-width: 900px;
  margin: 34px auto 42px;

  /* font-family / font-size / line-height 지정하지 않음 */
  /* → 블로그 기본 설정 그대로 상속 */

  box-sizing: border-box;
}

.bitmod-algo-explain *,
.bitmod-algo-explain *::before,
.bitmod-algo-explain *::after {
  box-sizing: border-box;
}


/* Intro */
.bitmod-algo-explain .bae-intro {
  margin: 0 0 30px;
  padding-left: 15px;

  border-left: 2px solid rgba(143, 166, 201, 0.55);

  /* 글꼴 / 크기 지정 없음 */
}


/* Step */
.bitmod-algo-explain .bae-step {
  padding-bottom: 26px;
  margin-bottom: 26px;

  border-bottom: 1px solid var(--bae-border);
}

.bitmod-algo-explain .bae-step:last-child {
  margin-bottom: 0;
  border-bottom: none;
}


/* 제목 */
.bitmod-algo-explain .bae-step-head {
  display: flex;
  align-items: baseline;
  gap: 8px;

  margin-bottom: 13px;
}

.bitmod-algo-explain .bae-step-index {
  font-weight: 700;
}

.bitmod-algo-explain .bae-step-title {
  font-weight: 700;
}


/* Line 2–3 같은 표시만 별도 디자인 */
.bitmod-algo-explain .bae-line {
  margin-left: auto;

  padding: 2px 7px;

  border: 1px solid rgba(143, 166, 201, 0.28);
  border-radius: 4px;

  color: var(--bae-accent);

  font-family: "Times New Roman", Times, serif;
  font-size: 0.75em;
  font-weight: 700;

  white-space: nowrap;
}


/* 설명 문장 */
.bitmod-algo-explain .bae-desc {
  margin: 0;

  /* 아무 Typography 지정 없음 */
  /* → 블로그 p 스타일 그대로 사용 */
}


/* Algorithm Expression */
.bitmod-algo-explain .bae-expression {
  margin-top: 14px;
  padding: 10px 14px;

  border-left: 2px solid rgba(143, 166, 201, 0.32);

  background: var(--bae-code-bg);

  /*
   * Algorithm 식만 논문 느낌을 위해
   * Times 계열 사용
   */
  font-family: "Times New Roman", Times, serif;

  line-height: 1.6;
}

.bitmod-algo-explain .bae-expression-line + .bae-expression-line {
  margin-top: 2px;
}

.bitmod-algo-explain .bae-key {
  font-weight: 700;
}


/* BasicValues / SpecialValues */
.bitmod-algo-explain .bae-values {
  margin-top: 15px;

  border-top: 1px solid var(--bae-border);
  border-bottom: 1px solid var(--bae-border);
}

.bitmod-algo-explain .bae-value-row {
  display: grid;

  grid-template-columns: 145px minmax(0, 1fr);

  gap: 15px;

  padding: 9px 4px;
}

.bitmod-algo-explain .bae-value-row + .bae-value-row {
  border-top: 1px solid var(--bae-border);
}

.bitmod-algo-explain .bae-value-label {
  font-weight: 700;
}

.bitmod-algo-explain .bae-value-content {
  font-family: "Times New Roman", Times, serif;
}


/* Candidate */
.bitmod-algo-explain .bae-candidates {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));

  margin-top: 14px;

  border-top: 1px solid var(--bae-border);
  border-bottom: 1px solid var(--bae-border);
}

.bitmod-algo-explain .bae-candidate {
  padding: 9px 10px;

  text-align: center;

  font-family: "Times New Roman", Times, serif;
}

.bitmod-algo-explain .bae-candidate + .bae-candidate {
  border-left: 1px solid var(--bae-border);
}


/* Quantization Level */
.bitmod-algo-explain .bae-level {
  margin-top: 15px;
  padding: 10px 4px;

  border-top: 1px solid var(--bae-border);
  border-bottom: 1px solid var(--bae-border);

  text-align: center;

  font-family: "Times New Roman", Times, serif;
}

.bitmod-algo-explain .bae-level-label {
  margin-bottom: 5px;

  /*
   * 여기는 설명 label이므로
   * 블로그 글꼴을 그대로 사용
   */
  font-family: inherit;

  font-size: 0.8em;
  font-weight: 700;

  opacity: 0.65;
}


/* MSE 수식 */
.bitmod-algo-explain .bae-formula {
  margin-top: 17px;
  padding: 14px 5px;

  border-top: 1px solid var(--bae-border);
  border-bottom: 1px solid var(--bae-border);

  overflow-x: auto;

  text-align: center;

  /* MathJax 자체 글꼴 사용 */
}


/* 변수 설명 */
.bitmod-algo-explain .bae-output-list {
  margin-top: 15px;

  border-top: 1px solid var(--bae-border);
}

.bitmod-algo-explain .bae-output-row {
  display: grid;

  grid-template-columns: 110px minmax(0, 1fr);

  gap: 15px;

  padding: 9px 4px;

  border-bottom: 1px solid var(--bae-border);
}

.bitmod-algo-explain .bae-output-name {
  color: var(--bae-accent);

  font-family: "Times New Roman", Times, serif;
  font-weight: 700;
}

.bitmod-algo-explain .bae-output-desc {
  /*
   * 설명 부분
   * 블로그 Typography 그대로 상속
   */
}


/* 마지막 */
.bitmod-algo-explain .bae-step-final .bae-step-title {
  color: var(--bae-accent);
}


/* Mobile */
@media (max-width: 650px) {

  .bitmod-algo-explain .bae-step-head {
    flex-wrap: wrap;
  }

  .bitmod-algo-explain .bae-line {
    margin-left: 0;
  }

  .bitmod-algo-explain .bae-value-row,
  .bitmod-algo-explain .bae-output-row {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .bitmod-algo-explain .bae-candidates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bitmod-algo-explain .bae-candidate:nth-child(3) {
    border-left: none;
    border-top: 1px solid var(--bae-border);
  }

  .bitmod-algo-explain .bae-candidate:nth-child(4) {
    border-top: 1px solid var(--bae-border);
  }

}

}
</style>


<div class="bitmod-algo-explain">


  <!-- =====================================================
       Intro
       ===================================================== -->

  <div class="bae-intro">

    Algorithm 1의 목적은 하나의 Weight Group에
    <strong>모든 Special Value 후보를 하나씩 적용</strong>한 뒤,
    원본 Weight와의 MSE가 가장 작은 Special Value를
    최종적으로 선택하는 것임.

  </div>


  <!-- =====================================================
       STEP 1
       ===================================================== -->

  <div class="bae-step">

    <div class="bae-step-head">

      <span class="bae-step-index">
        1.
      </span>

      <span class="bae-step-title">
        Basic Value와 Special Value 가져오기
      </span>

      <span class="bae-line">
        Line 2–3
      </span>

    </div>


    <p class="bae-desc">

      Quantization Precision <i>p</i>에 따라 Table IV에서
      Basic Quantization Value와 Special Value 후보를 가져옴.

      3-bit Quantization을 사용하는 경우,
      기본 FP3 값과 네 개의 Special Value 후보가 사용됨.

    </p>


    <div class="bae-expression">

      <div class="bae-expression-line">
        basicValues =
        GetBasicValues(<i>p</i>)
      </div>

      <div class="bae-expression-line">
        specialValues =
        GetSpecialValues(<i>p</i>)
      </div>

    </div>


    <div class="bae-values">

      <div class="bae-value-row">

        <div class="bae-value-label">
          Basic FP3
        </div>

        <div class="bae-value-content">
          {0, ±1, ±2, ±4}
        </div>

      </div>


      <div class="bae-value-row">

        <div class="bae-value-label">
          Special Values
        </div>

        <div class="bae-value-content">
          {-3, +3, -6, +6}
        </div>

      </div>

    </div>


    <div class="bae-candidates">

      <div class="bae-candidate">
        FP3 + (-3)
      </div>

      <div class="bae-candidate">
        FP3 + (+3)
      </div>

      <div class="bae-candidate">
        FP3 + (-6)
      </div>

      <div class="bae-candidate">
        FP3 + (+6)
      </div>

    </div>

  </div>



  <!-- =====================================================
       STEP 2
       ===================================================== -->

  <div class="bae-step">

    <div class="bae-step-head">

      <span class="bae-step-index">
        2.
      </span>

      <span class="bae-step-title">
        최소 Quantization Error 초기화
      </span>

      <span class="bae-line">
        Line 4
      </span>

    </div>


    <p class="bae-desc">

      아직 어떤 Special Value가 가장 적합한지 알 수 없으므로
      최소 Quantization Error를 무한대로 초기화함.

      이후 각 후보의 Error를 계산하면서 더 작은 값이 발견될 때마다
      <i>minError</i>를 갱신함.

    </p>


    <div class="bae-expression">
      minError = +∞
    </div>

  </div>



  <!-- =====================================================
       STEP 3
       ===================================================== -->

  <div class="bae-step">

    <div class="bae-step-head">

      <span class="bae-step-index">
        3.
      </span>

      <span class="bae-step-title">
        모든 Special Value를 하나씩 비교
      </span>

      <span class="bae-line">
        Line 5–6
      </span>

    </div>


    <p class="bae-desc">

      Special Value 후보를 하나씩 순회하면서 현재 선택된 값
      <i>v</i>를 Basic Value에 추가함.

      따라서 하나의 Weight Group에 대해 네 가지 서로 다른
      Quantization Data Type을 차례대로 시험하게 됨.

    </p>


    <div class="bae-expression">

      <div class="bae-expression-line">
        <span class="bae-key">for</span>
        <i>v</i> in specialValues
      </div>

      <div class="bae-expression-line">
        quantValues =
        basicValues ∪ <i>v</i>
      </div>

    </div>

  </div>



  <!-- =====================================================
       STEP 4
       ===================================================== -->

  <div class="bae-step">

    <div class="bae-step-head">

      <span class="bae-step-index">
        4.
      </span>

      <span class="bae-step-title">
        Non-linear Quantization 수행
      </span>

      <span class="bae-line">
        Line 7
      </span>

    </div>


    <p class="bae-desc">

      현재 선택된 Quantization Value 집합을 이용하여
      Weight Group <i>W</i>를 양자화함.

      BitMoD의 FP3/FP4는 Integer처럼 Quantization Level 사이의
      간격이 일정하지 않으므로 Non-linear Quantization을 사용함.

    </p>


    <div class="bae-expression">

      <i>W</i><sub>q</sub>
      =
      NonLinearQuantize(
      <i>W</i>, quantValues )

    </div>


    <div class="bae-level">

      <div class="bae-level-label">
        FP3-EA (+6) Quantization Level
      </div>

      −4 &nbsp;&nbsp;
      −2 &nbsp;&nbsp;
      −1 &nbsp;&nbsp;
      0 &nbsp;&nbsp;
      +1 &nbsp;&nbsp;
      +2 &nbsp;&nbsp;
      +4 &nbsp;&nbsp;
      +6

    </div>

  </div>



  <!-- =====================================================
       STEP 5
       ===================================================== -->

  <div class="bae-step">

    <div class="bae-step-head">

      <span class="bae-step-index">
        5.
      </span>

      <span class="bae-step-title">
        Quantization Error 계산
      </span>

      <span class="bae-line">
        Line 8
      </span>

    </div>


    <p class="bae-desc">

      원본 Weight <i>W</i>와 Quantized Weight
      <i>W</i><sub>q</sub> 사이의
      Mean Square Error(MSE)를 계산함.

      MSE가 작을수록 양자화된 Weight가 원본 Weight를
      더 정확하게 표현하고 있다는 의미임.

    </p>


    <div class="bae-expression">

      newError =
      MeanSquareError(
      <i>W</i>,
      <i>W</i><sub>q</sub> )

    </div>


    <div class="bae-formula">

      \[
      \mathrm{MSE}(W,W_q)
      =
      \frac{1}{N}
      \sum_{i=1}^{N}
      (W_i-W_{q,i})^2
      \]

    </div>

  </div>



  <!-- =====================================================
       STEP 6
       ===================================================== -->

  <div class="bae-step">

    <div class="bae-step-head">

      <span class="bae-step-index">
        6.
      </span>

      <span class="bae-step-title">
        가장 좋은 결과 저장
      </span>

      <span class="bae-line">
        Line 9–12
      </span>

    </div>


    <p class="bae-desc">

      현재 Special Value에서 계산된 MSE가 지금까지 발견한
      최소 Error보다 작다면 해당 결과를 새로운 최적 결과로 저장함.

    </p>


    <div class="bae-expression">

      <div class="bae-expression-line">
        <span class="bae-key">if</span>
        newError &lt; minError
      </div>

      <div class="bae-expression-line">
        &nbsp;&nbsp;&nbsp;&nbsp;minError = newError
      </div>

      <div class="bae-expression-line">
        &nbsp;&nbsp;&nbsp;&nbsp;<i>W</i><sub>qout</sub>
        = <i>W</i><sub>q</sub>
      </div>

      <div class="bae-expression-line">
        &nbsp;&nbsp;&nbsp;&nbsp;<i>v</i><sub>out</sub>
        = <i>v</i>
      </div>

    </div>


    <div class="bae-output-list">

      <div class="bae-output-row">

        <div class="bae-output-name">
          minError
        </div>

        <div class="bae-output-desc">
          현재까지 발견한 가장 작은 Quantization Error
        </div>

      </div>


      <div class="bae-output-row">

        <div class="bae-output-name">
          W<sub>qout</sub>
        </div>

        <div class="bae-output-desc">
          현재까지 가장 낮은 Error를 보인 Quantized Weight Group
        </div>

      </div>


      <div class="bae-output-row">

        <div class="bae-output-name">
          v<sub>out</sub>
        </div>

        <div class="bae-output-desc">
          해당 Quantized Weight를 생성한 Special Value
        </div>

      </div>

    </div>

  </div>



  <!-- =====================================================
       STEP 7
       ===================================================== -->

  <div class="bae-step bae-step-final">

    <div class="bae-step-head">

      <span class="bae-step-index">
        7.
      </span>

      <span class="bae-step-title">
        최종 결과 반환
      </span>

      <span class="bae-line">
        Line 13
      </span>

    </div>


    <p class="bae-desc">

      모든 Special Value 후보를 비교한 뒤,
      가장 낮은 MSE를 얻은 Quantized Weight Group
      <i>W</i><sub>qout</sub>과 해당 Special Value
      <i>v</i><sub>out</sub>을 최종 결과로 반환함.

    </p>


    <div class="bae-expression">

      <span class="bae-key">
        return
      </span>

      &nbsp;

      <i>W</i><sub>qout</sub>,
      <i>v</i><sub>out</sub>

    </div>

  </div>


</div>


예를 들어 다음과 같은 FP3 Weight Group이 있다고 가정함.

```text
W = [-0.8, 0.3, 1.1, 2.2, 3.8, 5.7]
```

Positive 방향에 큰 값 `5.7`이 존재하므로 각 Special Value를 적용했을 때 다음과 같은 결과가 나왔다고 가정할 수 있음.

| Special Value | Data Type 특성 | MSE 예시 |
|---|---|---:|
| -3 | Negative Resolution 증가 | 0.42 |
| +3 | Positive Resolution 증가 | 0.31 |
| -6 | Negative Range 확장 | 0.57 |
| **+6** | **Positive Range 확장** | **0.08** |

가장 작은 Error를 가지는 값이 `+6`이므로

$$
v_{out}=+6
$$

이 선택됨.

따라서 이 Weight Group은 최종적으로

$$
\{0,\pm1,\pm2,\pm4,+6\}
$$

을 사용하는 **FP3-EA(+6)**로 양자화됨.

반대로 Negative Outlier가 많은 다른 Group에서는 `-6`이 선택될 수 있고, 대칭적인 분포를 가진 Group에서는 `±3`을 사용하는 FP3-ER이 선택될 수 있음.

### Quantization 속도

Algorithm 1은 하나의 Weight Group을 기준으로 설명하고 있지만, 실제 구현에서는 GPU Vectorization을 통해 **Weight Tensor의 여러 Group에 대해 최적 Special Value를 동시에 탐색할 수 있음.**

논문의 구현에서는 하나의 NVIDIA A6000 GPU를 사용했을 때 **Llama-2-7B 전체 모델을 양자화하는 데 약 10초**가 소요됨.

따라서 Group마다 여러 Special Value를 비교하는 과정이 추가되더라도 실제 Quantization 과정의 Overhead는 크지 않음.

## C. Efficient Per-group Dequantization

Per-Group Quantization은 Weight를 작은 Group으로 나누어 Quantization Error를 줄일 수 있지만, **각 Group마다 서로 다른 Scaling Factor를 사용하기 때문에 Dequantization 비용이 증가하는 문제**가 있음.

BitMoD는 이를 해결하기 위해 Weight뿐만 아니라 **Per-Group Scaling Factor도 INT8로 한 번 더 Quantization**함.

이를 통해 Accuracy를 유지하면서 Per-Group Dequantization을 Hardware에서 효율적으로 처리할 수 있도록 함.

### 1. Quantization 이후에는 Dequantization이 필요함

Quantized Weight $W_q$는 실제 Weight 값 자체가 아니며, Scaling Factor $\Delta$를 함께 사용해야 원래 값에 가까운 Floating-Point Weight를 얻을 수 있음.

$$
W_{qf}=W_q\Delta
$$

예를 들어,

$$
W_q=3,\qquad \Delta=0.2
$$

라면 실제 연산에서 표현되는 Weight는

$$
W_{qf}=3\times0.2=0.6
$$

### 2. Per-Channel에서는 Dequantization이 비교적 간단함

Per-Channel Quantization에서는 하나의 Channel 전체가 동일한 Scaling Factor를 공유함.

예를 들어 하나의 Channel에 다음 Weight들이 있다고 가정함.

$$
W_q=[2,-1,3,1]
$$

그리고 Channel Scaling Factor가

$$
\Delta=0.2
$$

Activation이

$$
A=[1.0,2.0,0.5,1.5]
$$

라면 Quantized Weight와 Activation의 Dot-Product를 먼저 계산할 수 있음.

$$
P
=
2(1.0)+(-1)(2.0)+3(0.5)+1(1.5)
$$

$$
P=3
$$

모든 Weight가 같은 $\Delta$를 사용하므로 Scaling Factor는 마지막에 한 번만 적용하면 됨.

$$
Y=P\Delta
$$

$$
Y=3\times0.2=0.6
$$

따라서 Per-Channel에서는 **Dot-Product를 모두 끝낸 뒤 한 번만 Re-scaling**하면 됨.

### 3. Per-Group에서는 왜 문제가 생기는 이유

Per-Group Quantization에서는 하나의 Channel이 여러 Group으로 나뉘며 **각 Group이 서로 다른 Scaling Factor를 가짐.**

예를 들어 하나의 Channel이 두 Group으로 나누어져 있다고 가정함.

```text
Group 1
Wq = [2, -1]
Δ₁ = 0.1

Group 2
Wq = [3, 1]
Δ₂ = 0.4
```

Activation은 다음과 같다고 가정함.

$$
A=[1.0,2.0,0.5,1.5]
$$

#### Group 1

Group 1의 Dot-Product는

$$
P_1
=
2(1.0)+(-1)(2.0)
$$

$$
P_1=0
$$

Scaling Factor $\Delta_1=0.1$을 적용하면

$$
P_1\Delta_1
=
0\times0.1
=
0
$$

#### Group 2

Group 2에서는

$$
P_2
=
3(0.5)+1(1.5)
$$

$$
P_2=3
$$

이지만 Group 2의 Scaling Factor는

$$
\Delta_2=0.4
$$

이므로

$$
P_2\Delta_2
=
3\times0.4
=
1.2
$$

최종 Output은

$$
Y=P_1\Delta_1+P_2\Delta_2
$$

$$
Y=0+1.2=1.2
$$

**Group마다 Scaling Factor가 다르기 때문에 모든 Dot-Product를 먼저 더한 뒤 마지막에 Scaling Factor 하나만 적용할 수 없음.**

BitMoD는 Weight는 FP3, FP4, INT6 등의 Low-Precision으로 Quantization하지만 **Activation은 FP16으로 유지함.**

따라서 Group Dot-Product의 Partial Sum 역시 Floating-Point 형태가 됨.

기존 방식에서 Scaling Factor도 FP16이라면 Dequantization은 개념적으로

$$
\text{FP Partial Sum}
\times
\text{FP16 Scaling Factor}
$$

이를 Group마다 반복하기 위해서는 Floating-Point Multiplication을 지원하는 Hardware가 필요함.

즉, Low-Precision Weight를 통해 얻었던 Hardware Efficiency가 **Per-Group Dequantization 때문에 감소할 수 있음.**

### 4. BitMoD의 해결 방법: Scaling Factor도 Quantization

BitMoD는 **Scaling Factor에 Second-Level Quantization을 적용함.**

> **Weight를 Quantization한 뒤 생성된 Quantization Parameter를 한 번 더 Quantization하는 구조임.**

### 5. Scaling Factor Quantization 예시

하나의 Channel이 4개의 Group으로 나뉘어 있고 각각의 Scaling Factor가 다음과 같다고 가정함.

$$
[\Delta_1,\Delta_2,\Delta_3,\Delta_4]
=
[0.10,0.21,0.32,0.40]
$$

이 Scaling Factor들을 INT8 Symmetric Quantization한다고 하겠음.

INT8 Symmetric Quantization의 Positive Maximum은

$$
127
$$

이므로 Scaling Factor들을 Quantization하기 위한 **2차 Scaling Factor**를 다음과 같이 만들 수 있음.

$$
\Delta_{SF}
=
\frac{0.40}{127}
\approx0.00315
$$

이제 각 Per-Group Scaling Factor를 INT8로 변환함.

#### Group 1

$$
SF_{q,1}
=
Round
\left(
\frac{0.10}{0.00315}
\right)
$$

$$
SF_{q,1}\approx32
$$

#### Group 2

$$
SF_{q,2}
=
Round
\left(
\frac{0.21}{0.00315}
\right)
\approx67
$$

#### Group 3

$$
SF_{q,3}
\approx102
$$

#### Group 4

$$
SF_{q,4}
=127
$$

따라서 기존 Floating-Point Scaling Factor는

```text
FP Scaling Factors

[0.10, 0.21, 0.32, 0.40]
```

에서

```text
INT8 Scaling Factors

[32, 67, 102, 127]

공통 2차 Scaling Factor

ΔSF ≈ 0.00315
```

형태로 바뀜.

원래 Scaling Factor는 근사적으로

$$
\Delta_g
\approx
SF_{q,g}\Delta_{SF}
$$

로 복원할 수 있음.

예를 들어 Group 1은

$$
32\times0.00315
\approx0.1008
$$

이므로 원래

$$
0.10
$$

과 매우 비슷함.

### 6. Second-Level Quantization을 적용한 결과

원래 Output은

$$
Y
=
P_1\Delta_1
+
P_2\Delta_2
+
P_3\Delta_3
+
P_4\Delta_4
$$

임.

Scaling Factor를 INT8로 Quantization하면

$$
\Delta_g
\approx
SF_{q,g}\Delta_{SF}
$$

이므로

$$
Y
\approx
P_1SF_{q,1}\Delta_{SF}
+
P_2SF_{q,2}\Delta_{SF}
+
P_3SF_{q,3}\Delta_{SF}
+
P_4SF_{q,4}\Delta_{SF}
$$

가 됨.

$$
Y
\approx
\Delta_{SF}
\left(
P_1SF_{q,1}
+
P_2SF_{q,2}
+
P_3SF_{q,3}
+
P_4SF_{q,4}
\right)
$$

가 됨.

여기가 핵심임.

기존에는 Group마다

```text
P₁ × FP Δ₁
P₂ × FP Δ₂
P₃ × FP Δ₃
P₄ × FP Δ₄
```

가 필요했다면,

Scaling Factor Quantization 이후에는

```text
P₁ × INT8 SF₁
P₂ × INT8 SF₂
P₃ × INT8 SF₃
P₄ × INT8 SF₄
        ↓
       합산
        ↓
공통 Scaling 적용
```

형태로 바꿀 수 있음.

이러한 Integer Scaling Factor는 BitMoD Hardware에서 **Bit-Serial 방식으로 처리하기 쉬움.**

### 7. Scaling Factor를 몇 bit로 Quantization?

Scaling Factor까지 너무 낮은 Precision으로 Quantization하면 Accuracy가 감소할 수 있음.

따라서 논문에서는 Weight에 INT4-Asym Per-Group Quantization을 적용하고, Scaling Factor의 Precision을 변화시키면서 실험함.

Group Size는 128임.

$$
\begin{array}{c|cccc}
\hline
\text{SF Precision}
& \text{OPT-1.3B}
& \text{Phi-2B}
& \text{Llama-2-7B}
& \text{Llama-2-13B}
\\
\hline

\text{FP16}
& 15.41
& 10.68
& 5.77
& 5.01
\\

\mathbf{INT8}
& \mathbf{15.41}
& \mathbf{10.68}
& \mathbf{5.77}
& \mathbf{5.01}
\\

\text{INT6}
& 15.43
& 10.74
& 5.77
& 5.01
\\

\text{INT4}
& 15.52
& 10.76
& 5.77
& 5.03
\\

\text{INT2}
& 18.46
& 15.68
& 8.41
& 6.19
\\

\hline
\end{array}
$$

가장 중요한 결과는 **FP16과 INT8 Scaling Factor의 결과가 완전히 동일하다는 것**임.

즉 Scaling Factor를 FP16에서 INT8로 줄여도 Accuracy Loss가 발생하지 않음.

반면 INT2까지 낮추면 Scaling Factor 자체의 Quantization Error가 커지면서 모델 Perplexity가 크게 증가함.

따라서 BitMoD는 **INT8 Per-Group Scaling Factor를 최종적으로 선택함.**

### 8. Channel Size와 Group Size의 관계

Weight Channel의 크기를 $D$, Group Size를 $G$라고 하면 하나의 Channel에는

$$
\frac{D}{G}
$$

개의 Group이 존재함.

예를 들어 LLM의 Channel Size가

$$
D=4096
$$

이고 Group Size가

$$
G=128
$$

이라면

$$
\frac{4096}{128}=32
$$

이므로 하나의 Channel에는 32개의 Group이 존재함.

따라서 원래는

```text
Channel

Group 1   → Δ₁
Group 2   → Δ₂
Group 3   → Δ₃
...
Group 32  → Δ₃₂
```

처럼 32개의 Floating-Point Scaling Factor가 필요함.

BitMoD에서는 이 32개의 Scaling Factor를 다시 Symmetric Quantization하여

```text
Group 1   → INT8 SF₁
Group 2   → INT8 SF₂
Group 3   → INT8 SF₃
...
Group 32  → INT8 SF₃₂
```

형태로 저장함.

### 9. Memory Overhead

BitMoD에서는 Weight Group 하나당 추가로 저장해야 하는 정보가 두 가지임.

1. **INT8 Scaling Factor**

$$
8\text{ bits}
$$

2. Fine-grained Data Type Adaptation에서 어떤 Special Value를 선택했는지를 나타내는 Metadata

$$
2\text{ bits}
$$

따라서 Group 하나당 총 Metadata는

$$
8+2=10\text{ bits}
$$

### 10. 실제 Weight와 Metadata크기 비교

BitMoD에서 일반적으로 사용하는 Group Size가 128이라고 하겠음.

#### FP3 Weight

128개의 Weight를 FP3로 저장하면

$$
128\times3
=
384\text{ bits}
$$

가 필요함.

추가 Metadata는 10-bit이므로

$$
\frac{10}{384}
\times100
\approx2.6\%
$$

#### FP4 Weight

FP4라면

$$
128\times4
=
512\text{ bits}
$$

이고,

$$
\frac{10}{512}
\times100
\approx1.95\%
$$

즉 Group Size가 128 정도로 크면 **Scaling Factor와 Special Value 정보를 추가하더라도 Memory Overhead는 매우 작음.**

### 11. 기존 Asymmetric Integer Quantization과 비교

기존 Software PTQ의 Per-Group Asymmetric Integer Quantization에서는 Group마다 일반적으로 다음 정보가 필요함.

```text
Scaling Factor → FP16 = 16 bit
Zero-point     → INT8  =  8 bit

Total          → 24 bit / Group
```

반면 BitMoD는

```text
Scaling Factor     → INT8 = 8 bit
Special Value ID   →       2 bit

Total              →      10 bit / Group
```

| 방식 | Scaling Factor | 추가 Parameter | 총 Metadata |
|---|---:|---:|---:|
| 기존 Asymmetric PTQ | 16 bit | Zero-point 8 bit | **24 bit** |
| **BitMoD** | **8 bit** | **Special Value ID 2 bit** | **10 bit** |

따라서 BitMoD는 Per-Group Quantization을 사용하면서도 기존 Asymmetric PTQ보다 Metadata Overhead가 더 작음.

# ◼︎ BitMoD Hardware Accelerator

## A. Unified Bit-serial Representation

BitMoD Hardware는 하나의 Accelerator에서 다양한 Weight Precision과 Data Type을 지원하는 것을 목표로 함.

지원 대상은 다음과 같음.

- **INT8**
- **INT6**
- **FP4**
- **FP3**

INT8과 INT6는 높은 Accuracy가 필요한 경우 사용하고, FP4와 FP3는 더 높은 Weight Compression과 Hardware Efficiency가 필요한 경우 사용할 수 있음.

문제는 **Integer와 Floating Point의 표현 방식이 서로 다르다는 것**임.

```text
INT8 / INT6
→ Integer Representation

FP4 / FP3
→ Floating-Point Representation
```

각 Data Type마다 별도의 연산기를 만들면 Hardware Complexity와 Area Overhead가 증가함.

반대로 모든 Data Type을 INT8로 변환하면 구현은 단순해지지만, FP3나 FP4를 사용하더라도 실제 계산은 8-bit 수준으로 수행하게 되어 **Low-Precision Weight의 연산 효율 이점을 제대로 활용할 수 없음.**

따라서 BitMoD는 서로 다른 Data Type을 동일한 Hardware에서 처리하기 위해 **Unified Bit-serial Representation**을 제안함.

### Unified Bit-serial Term

BitMoD는 하나의 Weight를 한 번에 계산하지 않고 여러 개의 **Bit-serial Term**으로 분해함.

각 Bit-serial Term은 다음 네 가지 정보로 구성됨.

| Field | 의미 |
|---|---|
| **Sign** | 값의 부호 |
| **Exp** | Exponent |
| **Man** | Mantissa |
| **Bsig** | Bit-significance |

하나의 Bit-serial Term이 나타내는 값은 다음과 같음.

$$
v_{\text{term}}
=
(-1)^{sign}
\cdot
2^{exp}
\cdot
man
\cdot
2^{bsig}
$$

즉 하나의 Weight를

$$
W=T_1+T_2+\cdots+T_n
$$

처럼 여러 Term으로 분해하여 처리하는 방식임.

```text
INT8 ─┐
INT6 ─┤
FP4  ─┼─→ Unified Bit-serial Terms → BitMoD PE
FP3  ─┘

                  ↓

         Sign / Exp / Man / Bsig
```

이를 통해 Data Type이 달라도 동일한 PE를 사용할 수 있으며, **Precision이 낮아질수록 처리해야 하는 Bit-serial Term의 수도 감소함.**

즉 Weight Bit-width 감소가 단순히 Memory Footprint 감소에 그치지 않고 실제 Hardware Computation 감소로 이어짐.


### Figure 4. Unified Bit-serial Representation

<center><img src="/images/PR/BitMoD/figure4.png" width = "700"><br></center>

Figure 4는 BitMoD가 서로 다른 Data Type을 어떻게 공통 Bit-serial Term으로 변환하는지를 보여줌.

- **Figure 4(a)**: INT8 / INT6
- **Figure 4(b)**: FP4
- **FP3**: FP4와 동일한 Decoder Hardware 사용

결국 어떤 Data Type이 입력되더라도 최종적으로는

$$
\text{Sign}+\text{Exp}+\text{Man}+\text{Bsig}
$$

형태의 Bit-serial Term으로 변환되는 것이 핵심임.

### Figure 4(a) — INT8 / INT6

Figure 4(a)의 왼쪽을 보면 INT8과 INT6 Binary Weight가 여러 개의 **3-bit Booth String**으로 나누어져 있음.

BitMoD는 Integer Weight에 **Booth Encoding**을 적용하여 Bit-serial Term을 생성함.

#### INT8

INT8 Weight는

$$
I_7I_6I_5I_4I_3I_2I_1I_0
$$

의 8-bit로 구성되며, Figure 4(a)에서는 이를 4개의 Booth Term으로 분해함.

각 Term의 Bit-significance는 다음과 같음.

```text
INT8

Bsig = 6
Bsig = 4
Bsig = 2
Bsig = 0

→ 4개의 Bit-serial Term
```

Figure에서 괄호로 묶인 3-bit 영역 하나가 하나의 Booth String을 의미함.

인접한 Booth Term의 `Bsig`는 2씩 차이남.

#### INT6

INT6도 같은 Booth Encoding을 사용하지만 Precision이 낮기 때문에 필요한 Term 수가 더 적음.

```text
INT6

Bsig = 4
Bsig = 2
Bsig = 0

→ 3개의 Bit-serial Term
```

따라서

```text
INT8 → 4 Terms
INT6 → 3 Terms
```

으로 처리량이 줄어듦.

### Booth Encoding의 역할

Figure 4(a)의 오른쪽 `Truth Table of INT Booth Term`은 각 3-bit Booth String이 어떤 연산으로 Decode되는지를 보여줌.

| 3-bit String | Operation | Sign | Exp | Man |
|---|---:|---:|---:|---:|
| `000 / 111` | $0$ | 0 | 0 | 0 |
| `001 / 010` | $+x$ | 0 | 0 | 1 |
| `110 / 101` | $-x$ | 1 | 0 | 1 |
| `011` | $+2x$ | 0 | 1 | 1 |
| `100` | $-2x$ | 1 | 1 | 1 |

즉 각 Booth String은

```text
0
+x
-x
+2x
-2x
```

중 하나의 간단한 연산으로 변환됨.

예를 들어 Figure 4의 `011` Booth String은

$$
+2x
$$

이에 대응하는 Field는

```text
Sign = 0
Exp  = 1
Man  = 1
```

이며,

$$
(-1)^0
\cdot
2^1
\cdot
1
=
2
$$

이므로 $+2x$가 됨.

반대로 `100`이면

```text
Sign = 1
Exp  = 1
Man  = 1
```

이므로

$$
(-1)^1
\cdot
2^1
\cdot
1
=
-2
$$

가 되어 $-2x$를 나타냄.

즉 Figure 4(a)의 Truth Table은 **Integer의 Booth String을 Sign / Exp / Man 정보로 Decode하는 과정**을 보여줌.

### Bsig(Bit-significance)

`Bsig`는 현재 Bit-serial Term이 원래 Weight의 어느 위치에 해당하는지를 나타냄.

예를 들어 동일한 $+x$ Term이라고 하더라도

```text
Bsig = 0
→ x × 2⁰

Bsig = 2
→ x × 2²

Bsig = 4
→ x × 2⁴

Bsig = 6
→ x × 2⁶
```

처럼 실제 기여하는 값의 크기가 달라짐.

따라서 하나의 Bit-serial Term은 최종적으로

$$
(-1)^{Sign}
\times
2^{Exp}
\times
Man
\times
2^{Bsig}
$$

으로 표현됨.

즉,

- `Sign / Exp / Man` → Booth String 자체가 어떤 값을 의미하는지 표현함.
- `Bsig` → 그 값이 원래 Integer Weight의 어느 Bit 위치에 있는지를 표현함.

### Figure 4(b) — FP4

INT8과 INT6는 Booth Encoding을 통해 Bit-serial Term으로 분해할 수 있지만, FP4는 Floating-Point Format이므로 같은 방식으로 바로 처리할 수 없음.

BitMoD는 Figure 4(b)처럼 FP4를 먼저 **Fixed-Point 형태로 변환한 뒤 Bit-serial Term을 생성함.**

Figure 4(b)의 전체 흐름은 다음과 같음.

```text
FP4
 ↓
FP → Fixed
 ↓
Redundant -0 확인
 ↓
 ┌───────────────┐
 │               │
일반 값          -0
 │               │
그대로 사용      Group의 Special Value로 교체
 │               │
 └───────┬───────┘
         ↓
   Fixed-Point Value
         ↓
        LOD
         ↓
최대 2개의 Bit-serial Term
```

### FP4 → Fixed-Point 변환

Figure 4(b)의 가장 왼쪽을 보면 FP4는

```text
S | E₁ E₀ | M
```

형태로 들어옴.

BitMoD는 이를 다음과 같은 Fixed-Point 형태로 변환함.

```text
S | I₃ I₂ I₁ I₀ | F₀
```

각 Bit는 다음 값을 담당함.

```text
I₃ → 8
I₂ → 4
I₁ → 2
I₀ → 1
F₀ → 0.5
```

#### 왜 Integer Bit가 4개 필요한가?

BitMoD의 FP4-EA는 Special Value로 최대

$$
\pm8
$$

까지 사용함.

따라서 `8`을 표현하기 위해 $I_3$까지 필요함.

#### 왜 Fraction Bit가 필요한가?

기본 FP4에는

$$
\pm0.5,\qquad \pm1.5
$$

같은 값이 존재함.

예를 들어

$$
1.5=1+0.5
$$

이므로 Fixed-Point에서는

```text
I₀ = 1
F₀ = 1
```

로 표현할 수 있음.

### Figure 4(b)의 `eq` — Redundant -0 검사

Figure 4(b)의 중앙 아래에는 `eq` Comparator가 존재함.

이 회로의 역할은 현재 입력이 **Redundant Negative Zero(-0)**인지 확인하는 것임.

기본 Floating Point에서는

```text
+0
-0
```

이 서로 다른 Bit Pattern을 가지지만 실제 값은 모두 0임.

BitMoD에서는 이 중 `-0` Bit Pattern을 앞의 Quantization Framework에서 **Special Value를 나타내는 Encoding으로 재사용함.**

따라서 Hardware에서는

```text
FP4
 ↓
Fixed 변환
 ↓
-0인가?
```

를 확인함.

- `-0`가 아니라면 → 변환된 Fixed-Point 값을 그대로 사용
- `-0`라면 → 현재 Weight Group에 지정된 Special Value를 사용

함.

Figure 4의 `eq` 출력이 MUX의 Select Signal로 연결되어 있는 이유가 이것임.

### Figure 4(b)의 `SV_reg`

Figure 위쪽의 `SV_reg`에는 BitMoD가 사용할 수 있는 네 개의 Special Value가 저장됨.

FP4에서는 예를 들어

```text
SV₀ = -5
SV₁ = +5
SV₂ = -8
SV₃ = +8
```

을 저장할 수 있음.

앞의 **Fine-grained Data Type Adaptation**에서 Weight Group마다 어떤 Special Value가 가장 좋은지를 결정했음.

그리고 Group마다 저장된 2-bit Metadata를 이용해 `SV_reg`에서 해당 값을 선택함.

예를 들어

```text
00 → -5
01 → +5
10 → -8
11 → +8
```

처럼 사용할 수 있음.

따라서 앞에서 Software Quantization 단계에서

```text
Group 1 → +5
Group 2 → -8
Group 3 → +8
```

과 같이 결정한 정보가 실제 Hardware에서는 Figure 4(b)의 `SV_reg + MUX`를 통해 사용되는 것임.

### LOD(Leading-One Detector)

Figure 4(b)의 오른쪽에는 두 개의 **LOD(Leading-One Detector)**가 존재함.

BitMoD가 LOD를 사용할 수 있는 이유는 Extended FP4의 모든 값이 Fixed-Point로 변환된 후 **최대 두 개의 `1` Bit만 가지기 때문임.**

따라서 FP4 값을 복잡한 Floating-Point Multiplier로 처리하는 대신, `1`이 존재하는 위치를 최대 두 개만 찾아내면 됨.

#### 예시 1 — FP4 값 6

$$
6=4+2
$$

이므로 Fixed-Point에서는

```text
        I₃  I₂  I₁  I₀  F₀
        8   4   2   1   0.5

6   →   0   1   1   0    0
            ↑   ↑
          Term1 Term2
```

가 됨.

즉

$$
6=2^2+2^1
$$

이므로 두 개의 Bit-serial Term만 필요함.

#### 예시 2 — FP4 값 1.5

$$
1.5=1+0.5
$$

이므로

```text
        I₃  I₂  I₁  I₀  F₀

1.5 →   0   0   0   1    1
                    ↑    ↑
                  Term1 Term2
```

가 됨.

역시 두 개의 Bit-serial Term으로 표현 가능함.

### Figure 4의 두 LOD가 보는 영역

Figure를 보면 두 LOD가 동일한 Bit 전체를 보는 것이 아니라 서로 조금 다른 영역을 검사함.

첫 번째 LOD는

$$
\{I_3,I_2,I_1,I_0\}
$$

을 검사하고,

두 번째 LOD는

$$
\{I_2,I_1,I_0,F_0\}
$$

을 검사함.

```text
Fixed-Point

S | I₃ I₂ I₁ I₀ F₀
      └───────┘
        LOD 1

         └────────┘
           LOD 2
```

이를 통해 Fixed-Point Value 안에 존재하는 최대 두 개의 `1` 위치를 찾아냄.

Figure 오른쪽에서 각 LOD가

```text
Exp
Man
```

을 출력하는 이유도 이 때문임.

LOD가 찾은 `1`의 위치를 이용하여 해당 Bit-serial Term의 Exponent와 Mantissa 정보를 생성함.

그리고 Sign은 Fixed-Point Value의 `S` Bit에서 가져옴.

최종적으로 FP4도

```text
Sign | Exp | Man | Bsig
```

형태의 Bit-serial Term으로 변환됨.

### FP3의 처리

Extended FP3에서 사용하는 값은 Extended FP4로 표현 가능한 값의 부분집합임.

따라서 별도의 FP3 Decoder를 만들 필요 없이 Figure 4(b)의 **FP4 Decoder Hardware를 그대로 재사용**할 수 있음.

```text
FP3
 ↓
FP → Fixed
 ↓
Special Value 처리
 ↓
LOD
 ↓
Bit-serial Terms
```

즉 FP3와 FP4가 동일한 Hardware Decoder를 공유함.

### Programmable Special Value

BitMoD의 `SV_reg`는 특정 Special Value가 Hardware에 완전히 고정되어 있는 구조가 아님.

현재 논문에서는

```text
FP3 → ±3, ±6
FP4 → ±5, ±8
```

을 사용하지만, 다른 LLM에서 다른 Special Value가 더 좋은 Quantization 결과를 보인다면 Register에 다른 값을 Programming할 수도 있음.

예를 들어 Special Value가 `7`이라고 하면 일반적인 Binary 표현은

$$
7=4+2+1
$$

이므로

$$
7=2^2+2^1+2^0
$$

으로 총 3개의 Term이 필요함.

하지만 Decoder를 약간 수정하여

$$
7=8-1
$$

로 표현하면

$$
7=2^3-2^0
$$

이므로 두 개의 Term만 필요함.

```text
일반적인 표현

7 = 4 + 2 + 1
→ 3 Bit-serial Terms


최적화된 표현

7 = 8 - 1
→ 2 Bit-serial Terms
```

따라서 다른 Special Value를 사용하더라도 Decoder를 간단히 수정하여 필요한 Bit-serial Term 수를 줄일 수 있음.

| Data Type | 변환 방법 | Bit-serial Term 수 |
|---|---|---:|
| **INT8** | Booth Encoding | 4 |
| **INT6** | Booth Encoding | 3 |
| **FP4** | FP→Fixed + LOD | 최대 2 |
| **FP3** | FP→Fixed + LOD | 최대 2 |

<div class="bitmod-demo">

  <!-- =============================================
       Mode
  ============================================== -->

  <div class="bm-tabs">
    <button class="bm-tab active" data-mode="int8">INT8</button>
    <button class="bm-tab" data-mode="int6">INT6</button>
    <button class="bm-tab" data-mode="fp4">FP4</button>
    <button class="bm-tab" data-mode="fp4sv">FP4 -0 → SV</button>
    <button class="bm-tab" data-mode="fp3">FP3</button>
  </div>


  <!-- =============================================
       Input Controls
  ============================================== -->

  <div class="bm-controls">

    <label id="int-control" class="bm-control">
      <span class="bm-control-label">Integer Value</span>

      <input
        id="int-input"
        type="number"
        value="45"
        min="-128"
        max="127"
      >
    </label>


    <label
      id="fp4-control"
      class="bm-control"
      style="display:none;"
    >
      <span class="bm-control-label">FP4 Value</span>

      <select id="fp4-input">
        <option value="0.5">+0.5</option>
        <option value="1">+1</option>
        <option value="1.5">+1.5</option>
        <option value="2">+2</option>
        <option value="3">+3</option>
        <option value="4">+4</option>
        <option value="6" selected>+6</option>

        <option value="-0.5">-0.5</option>
        <option value="-1">-1</option>
        <option value="-1.5">-1.5</option>
        <option value="-2">-2</option>
        <option value="-3">-3</option>
        <option value="-4">-4</option>
        <option value="-6">-6</option>
      </select>
    </label>


    <label
      id="fp4sv-control"
      class="bm-control"
      style="display:none;"
    >
      <span class="bm-control-label">Special Value</span>

      <select id="fp4sv-input">
        <option value="5">+5</option>
        <option value="-5">-5</option>
        <option value="8" selected>+8</option>
        <option value="-8">-8</option>
      </select>
    </label>


    <label
      id="fp3-control"
      class="bm-control"
      style="display:none;"
    >
      <span class="bm-control-label">FP3 Value</span>

      <select id="fp3-input">

        <optgroup label="Basic FP3">
          <option value="1">+1</option>
          <option value="2">+2</option>
          <option value="4" selected>+4</option>
          <option value="-1">-1</option>
          <option value="-2">-2</option>
          <option value="-4">-4</option>
        </optgroup>

        <optgroup label="Special Value (-0 Encoding)">
          <option value="sv3">+3</option>
          <option value="sv-3">-3</option>
          <option value="sv6">+6</option>
          <option value="sv-6">-6</option>
        </optgroup>

      </select>
    </label>

  </div>


  <!-- =============================================
       Step Title
  ============================================== -->

  <div class="bm-step-label">
    <span id="bm-step-number"></span>
    <strong id="bm-step-title"></strong>
  </div>


  <!-- =============================================
       Flow
  ============================================== -->

  <div class="bm-flow-wrapper">

    <div
      class="bm-flow"
      id="bm-flow"
    ></div>

  </div>


  <!-- =============================================
       Navigation
  ============================================== -->

  <div class="bm-buttons">

    <button id="bm-prev">
      ← Previous
    </button>

    <button id="bm-next">
      Next Step →
    </button>

  </div>


  <!-- =============================================
       Explanation
  ============================================== -->

  <div class="bm-explanation">

    <p id="bm-desc"></p>

    <div
      class="bm-calc"
      id="bm-calc"
    ></div>

  </div>

</div>


<style>

/* =========================================================
   BitMoD Figure 4 Demo
========================================================= */

.bitmod-demo {

  --bm-accent: #a9bfdf;

  --bm-text:
    rgba(242, 245, 250, 0.94);

  --bm-text-secondary:
    rgba(226, 231, 240, 0.76);

  --bm-text-inactive:
    rgba(219, 225, 235, 0.46);

  --bm-border:
    rgba(215, 222, 234, 0.23);

  --bm-border-strong:
    rgba(215, 222, 234, 0.38);

  --bm-bg:
    rgba(255, 255, 255, 0.025);

  --bm-bg-active:
    rgba(169, 191, 223, 0.10);


  width: 100%;
  max-width: 1000px;

  margin: 32px auto;

  color: var(--bm-text);

  box-sizing: border-box;
}


.bitmod-demo *,
.bitmod-demo *::before,
.bitmod-demo *::after {
  box-sizing: border-box;
}


/* =========================================================
   Tabs
========================================================= */

.bm-tabs {

  display: flex;
  flex-wrap: wrap;

  gap: 8px;

  margin-bottom: 28px;
}


.bm-tab,
.bm-buttons button {

  padding: 7px 14px;

  border:
    1px solid
    var(--bm-border-strong);

  border-radius: 6px;

  background:
    rgba(255,255,255,.015);

  color:
    var(--bm-text);

  font: inherit;

  cursor: pointer;

  transition:
    border-color .2s ease,
    background .2s ease,
    color .2s ease;
}


.bm-tab:hover,
.bm-buttons button:hover {

  background:
    rgba(255,255,255,.05);
}


.bm-tab.active {

  color:
    var(--bm-accent);

  border-color:
    var(--bm-accent);

  background:
    rgba(169,191,223,.07);
}


/* =========================================================
   Controls
========================================================= */

.bm-controls {

  min-height: 75px;

  margin-bottom: 28px;

  display: flex;
  align-items: flex-start;
}


.bm-control {

  display: inline-flex;
  flex-direction: column;

  gap: 8px;

  color:
    var(--bm-text) !important;
}


/*
  여기 중요함.

  screenshot에서 안 보이던
  FP4 Value / Special Value 글씨
*/

.bm-control-label {

  color:
    rgba(242,245,250,.90) !important;

  font-weight: 600;

  opacity: 1 !important;
}


/*
  닫혀 있는 select의 현재 선택값까지
  밝은색으로 강제 지정
*/

.bm-controls input,
.bm-controls select {

  min-width: 100px;

  padding: 7px 12px;

  border:
    1px solid
    var(--bm-border-strong);

  border-radius: 6px;

  background:
    #252c37 !important;

  color:
    #eef2f8 !important;

  font: inherit;

  opacity: 1 !important;

  color-scheme: dark;
}


/*
  일부 브라우저가 select 내부 text에
  별도 색상을 적용하는 경우 방지
*/

.bm-controls select {

  -webkit-text-fill-color:
    #eef2f8 !important;
}


.bm-controls input {

  -webkit-text-fill-color:
    #eef2f8 !important;
}


/* Dropdown을 펼쳤을 때 */

.bm-controls option,
.bm-controls optgroup {

  background:
    #252c37;

  color:
    #eef2f8;
}


/* Focus */

.bm-controls input:focus,
.bm-controls select:focus {

  outline:
    1px solid
    var(--bm-accent);

  border-color:
    var(--bm-accent);
}


/* =========================================================
   Step title
========================================================= */

.bm-step-label {

  display: flex;

  align-items: center;

  gap: 12px;

  margin-bottom: 22px;

  color:
    var(--bm-text);
}


#bm-step-number {

  padding: 4px 8px;

  color:
    var(--bm-accent);

  border:
    1px solid
    rgba(169,191,223,.48);

  border-radius: 5px;

  background:
    rgba(169,191,223,.045);

  white-space: nowrap;
}


#bm-step-title {

  color:
    rgba(245,247,251,.97);

  font-weight: 700;
}


/* =========================================================
   Horizontal Flow Wrapper
========================================================= */

.bm-flow-wrapper {

  width: 100%;

  overflow: hidden;

  margin-bottom: 14px;
}


/*
  flex-start가 중요함.

  center + overflow-x 조합에서
  첫 번째 박스가 잘리는 문제 방지.
*/

.bm-flow {

  display: flex;

  align-items: stretch;

  justify-content: flex-start;

  gap: 0;

  width: 100%;

  min-height: 180px;

  overflow-x: auto;
  overflow-y: visible;

  padding:
    20px 20px
    24px 20px;

  scroll-padding-left: 20px;
  scroll-padding-right: 20px;

  scrollbar-width: auto;
}


/* =========================================================
   Nodes
========================================================= */

.bm-box {

  flex:
    0 0 125px;

  min-width:
    125px;

  display: flex;
  flex-direction: column;

  justify-content:
    space-between;

  gap: 12px;

  padding:
    15px 12px;

  text-align:
    center;

  border:
    1px solid
    rgba(215,222,234,.12);

  border-radius:
    8px;

  background:
    rgba(255,255,255,.012);

  /*
    박스 전체 opacity를 낮추지 않음.
    이게 기존 dark mode 문제의 핵심이었음.
  */
  opacity: 1;

  color:
    var(--bm-text-inactive);

  transition:
    color .25s ease,
    border-color .25s ease,
    background .25s ease,
    transform .25s ease;
}


/* 이미 지나간 단계 */

.bm-box.done {

  color:
    var(--bm-text-secondary);

  border-color:
    var(--bm-border);

  background:
    rgba(255,255,255,.025);
}


/* 현재 단계 */

.bm-box.active {

  color:
    rgba(248,250,253,.98);

  border-color:
    var(--bm-accent);

  background:
    var(--bm-bg-active);

  transform:
    translateY(-4px);
}


/* title */

.bm-title {

  color: inherit;

  font-weight: 700;

  line-height: 1.55;
}


/* 실제 숫자 */

.bm-value {

  color: inherit;

  font-family:
    "Times New Roman",
    Times,
    serif;

  line-height: 1.75;

  white-space: pre-line;

  word-break: normal;
}


/* =========================================================
   Arrows
========================================================= */

.bm-arrow {

  position: relative;

  flex:
    0 0 40px;

  display: flex;

  align-items: center;

  justify-content: center;

  color:
    rgba(220,226,236,.47);

  font-size: 21px;
}


.bm-arrow.active {

  color:
    var(--bm-accent);
}


/* Moving dot */

.bm-arrow.active::after {

  content: "";

  position: absolute;

  left: 7px;

  top: 50%;

  width: 5px;
  height: 5px;

  border-radius: 50%;

  background:
    var(--bm-accent);

  animation:
    bmMove .9s linear infinite;
}


@keyframes bmMove {

  from {

    transform:
      translate(0,-50%);
  }

  to {

    transform:
      translate(25px,-50%);
  }

}


/* =========================================================
   Navigation
========================================================= */

.bm-buttons {

  display: flex;

  justify-content: center;

  gap: 8px;

  margin:
    10px 0
    24px;
}


/* =========================================================
   Explanation
========================================================= */

.bm-explanation {

  padding-top:
    20px;

  border-top:
    1px solid
    rgba(215,222,234,.16);

  color:
    var(--bm-text);
}


.bm-explanation p {

  margin:
    0 0 14px;

  color:
    var(--bm-text);

  opacity: 1;
}


.bm-calc {

  padding:
    14px 16px;

  border-left:
    2px solid
    rgba(169,191,223,.58);

  background:
    rgba(255,255,255,.035);

  color:
    rgba(240,243,249,.94);

  font-family:
    "Times New Roman",
    Times,
    serif;

  line-height:
    1.8;

  white-space:
    pre-line;

  overflow-x:
    auto;
}


/* =========================================================
   Mobile
========================================================= */

@media (max-width: 700px) {

  .bm-flow {

    flex-direction:
      column;

    overflow:
      visible;

    padding:
      10px 0 20px;
  }


  .bm-box {

    width:
      100%;

    min-width:
      0;

    flex:
      none;
  }


  .bm-arrow {

    width:
      100%;

    flex:
      0 0 30px;

    transform:
      rotate(90deg);
  }


  .bm-controls {

    min-height:
      80px;
  }

}


@media (prefers-reduced-motion: reduce) {

  .bm-arrow.active::after {

    animation:
      none;
  }


  .bm-box {

    transition:
      none;
  }

}

</style>


<script>

/* =========================================================
   Booth Table
========================================================= */

const boothTable = {

  "000": {
    op: "0",
    coefficient: 0,
    sign: 0,
    exp: 0,
    man: 0
  },

  "111": {
    op: "0",
    coefficient: 0,
    sign: 0,
    exp: 0,
    man: 0
  },

  "001": {
    op: "+x",
    coefficient: 1,
    sign: 0,
    exp: 0,
    man: 1
  },

  "010": {
    op: "+x",
    coefficient: 1,
    sign: 0,
    exp: 0,
    man: 1
  },

  "101": {
    op: "−x",
    coefficient: -1,
    sign: 1,
    exp: 0,
    man: 1
  },

  "110": {
    op: "−x",
    coefficient: -1,
    sign: 1,
    exp: 0,
    man: 1
  },

  "011": {
    op: "+2x",
    coefficient: 2,
    sign: 0,
    exp: 1,
    man: 1
  },

  "100": {
    op: "−2x",
    coefficient: -2,
    sign: 1,
    exp: 1,
    man: 1
  }

};


/* =========================================================
   Integer → Two's Complement
========================================================= */

function toBinary(value,bits) {

  const range =
    Math.pow(2,bits);

  let unsigned =
    value;


  if (value < 0) {

    unsigned =
      range + value;
  }


  return unsigned
    .toString(2)
    .padStart(bits,"0");
}


/* =========================================================
   Radix-4 Booth Encoding
========================================================= */

function boothEncode(value,width) {

  const binary =
    toBinary(value,width);


  const lsb =
    binary
      .split("")
      .reverse();


  const count =
    width / 2;


  const result =
    [];


  for (
    let k=0;
    k<count;
    k++
  ) {

    const previous =
      k === 0
      ? "0"
      : lsb[2*k-1];


    const current =
      lsb[2*k] !== undefined
      ? lsb[2*k]
      : binary[0];


    const next =
      lsb[2*k+1] !== undefined
      ? lsb[2*k+1]
      : binary[0];


    const string =
      next +
      current +
      previous;


    const decoded =
      boothTable[string];


    const bsig =
      2*k;


    const contribution =
      decoded.coefficient *
      Math.pow(2,bsig);


    result.push({

      string,

      bsig,

      ...decoded,

      contribution

    });

  }


  return {

    binary,

    terms: result

  };

}


/* =========================================================
   Fixed Point

   I3 I2 I1 I0 F0
    8  4  2  1  0.5
========================================================= */

function fixedPoint(value) {

  const sign =
    value < 0
    ? 1
    : 0;


  let remaining =
    Math.abs(value);


  const powers =
    [8,4,2,1,0.5];


  const bits =
    [];


  const terms =
    [];


  powers.forEach(power => {

    if (
      remaining >=
      power - 0.00001
    ) {

      bits.push(1);

      remaining -=
        power;


      terms.push(

        sign
        ? -power
        : power

      );

    }

    else {

      bits.push(0);

    }

  });


  return {

    sign,

    bits,

    terms,

    text:

      sign +

      " | " +

      bits
        .slice(0,4)
        .join(" ") +

      " | " +

      bits[4]

  };

}


/* =========================================================
   FP4 Encoding
========================================================= */

const fp4Magnitude = {

  "0.5": "001",
  "1":   "010",
  "1.5": "011",
  "2":   "100",
  "3":   "101",
  "4":   "110",
  "6":   "111"

};


function fp4Encoding(value) {

  const sign =
    value < 0
    ? "1"
    : "0";


  const magnitude =
    fp4Magnitude[
      String(
        Math.abs(value)
      )
    ];


  return (
    sign +
    magnitude
  );

}


/* =========================================================
   INT8 / INT6 Data
========================================================= */

function createIntegerData(width) {

  const input =
    document
      .getElementById(
        "int-input"
      );


  const min =
    -Math.pow(
      2,
      width-1
    );


  const max =
    Math.pow(
      2,
      width-1
    ) - 1;


  let value =
    Number(
      input.value
    );


  value =
    Math.max(
      min,
      Math.min(
        max,
        value
      )
    );


  input.value =
    value;


  const result =
    boothEncode(
      value,
      width
    );


  const terms =
    result
      .terms
      .slice()
      .reverse();


  const termString =
    terms
      .map(t =>

        (
          t.contribution >= 0
          ? "+"
          : ""
        )

        +

        t.contribution

      )
      .join(" ");


  const fieldString =
    terms
      .map(t =>

`${t.string}

Sign = ${t.sign}
Exp  = ${t.exp}
Man  = ${t.man}
Bsig = ${t.bsig}`

      )
      .join("\n\n");


  const sum =
    terms.reduce(

      (total,term) =>
        total +
        term.contribution,

      0

    );


  return [

    {

      title:
        `${width === 8 ? "INT8" : "INT6"} Value`,

      value:
        value,

      desc:
        `${width}-bit Integer Weight가 입력됨.`,

      calc:
        `Input Weight = ${value}`

    },


    {

      title:
        "Binary",

      value:
        result.binary,

      desc:
        `${value}를 ${width}-bit Two's Complement Binary로 변환함.`,

      calc:
        `${value} → ${result.binary}`

    },


    {

      title:
        "Booth Encoding",

      value:

        terms
          .map(t =>

`${t.string}
Bsig=${t.bsig}`

          )
          .join("\n"),

      desc:

        width === 8

        ? "INT8은 Figure 4(a)와 같이 4개의 3-bit Booth String으로 분해됨."

        : "INT6은 Figure 4(a)와 같이 3개의 3-bit Booth String으로 분해됨.",


      calc:

        terms
          .map(t =>

`${t.string}
→ ${t.op}
Bsig = ${t.bsig}`

          )
          .join("\n\n")

    },


    {

      title:
        "Terms",

      value:
        termString,

      desc:
        "각 Booth String의 Operation과 Bsig를 이용하여 실제 numerical contribution을 계산함.",

      calc:

        terms
          .map(t =>

`${t.op} × 2^${t.bsig}

= ${t.contribution}`

          )
          .join("\n\n")

    },


    {

      title:
        "Unified Fields",

      value:
`Sign
Exp
Man
Bsig`,

      desc:
        "각 Booth Term은 최종적으로 Sign / Exp / Man / Bsig 형태로 변환됨.",

      calc:
        fieldString

    },


    {

      title:
        "Result",

      value:
`${termString}

= ${sum}`,

      desc:
        "각 Bit-serial Term을 합하면 원래 Integer Weight가 복원됨.",

      calc:
`${termString}

= ${sum}

Original Weight = ${value}`

    }

  ];

}


/* =========================================================
   FP4 Normal
========================================================= */

function createFP4Data() {

  const value =
    Number(

      document
        .getElementById(
          "fp4-input"
        )
        .value

    );


  const encoding =
    fp4Encoding(value);


  const fixed =
    fixedPoint(value);


  const termString =
    fixed
      .terms
      .map(v =>

        (
          v > 0
          ? "+"
          : ""
        )

        + v

      )
      .join(" ");


  return [

    {

      title:
        "FP4 Value",

      value:
        value,

      desc:
        "Extended FP4의 일반 Quantized Value가 입력됨.",

      calc:
        `FP4 Value = ${value}`

    },


    {

      title:
        "FP4 Encoding",

      value:
`${encoding[0]} | ${encoding.slice(1,3)} | ${encoding[3]}`,

      desc:
        "FP4의 Sign / Exponent / Mantissa Encoding으로 표현함.",

      calc:
`S | E₁E₀ | M

${encoding[0]} | ${encoding.slice(1,3)} | ${encoding[3]}`

    },


    {

      title:
        "FP → Fixed",

      value:
        fixed.text,

      desc:
        "Figure 4(b)의 FP→Fixed 블록에서 Sign-Magnitude Fixed-Point 형태로 변환함.",

      calc:
`S | I₃ I₂ I₁ I₀ | F₀

${fixed.text}

    8  4  2  1  0.5`

    },


    {

      title:
        "-0 Check",

      value:
`eq =
false`,

      desc:
        "현재 값은 Redundant -0가 아니므로 Special Value 경로를 사용하지 않음.",

      calc:
`${encoding} ≠ -0

MUX → Normal Fixed Value`

    },


    {

      title:
        "LOD",

      value:

        fixed
          .terms
          .map(
            (v,index) =>
              `Term ${index+1} = ${v}`
          )
          .join("\n"),

      desc:
        "LOD가 Fixed-Point에서 1이 존재하는 위치를 찾아 최대 두 개의 Bit-serial Term으로 분해함.",

      calc:
`${value}

= ${termString}`

    },


    {

      title:
        "Result",

      value:
`${termString}

= ${value}`,

      desc:
        "추출된 Term을 더하면 원래 FP4 값이 됨.",

      calc:
`${termString}

= ${value}

→ Sign / Exp / Man / Bsig`

    }

  ];

}


/* =========================================================
   FP4 -0 → Special Value
========================================================= */

function createFP4SVData() {

  const sv =
    Number(

      document
        .getElementById(
          "fp4sv-input"
        )
        .value

    );


  const fixed =
    fixedPoint(sv);


  const termString =
    fixed
      .terms
      .map(v =>

        (
          v > 0
          ? "+"
          : ""
        )

        + v

      )
      .join(" ");


  return [

    {

      title:
        "Stored FP4",

      value:
`1 | 00 | 0`,

      desc:
        "Weight에는 Redundant Negative Zero(-0)의 Bit Pattern이 저장되어 있다고 가정함.",

      calc:
`S | E₁E₀ | M

1 | 00 | 0

= -0`

    },


    {

      title:
        "-0 Check",

      value:
`eq =

TRUE`,

      desc:
        "Figure 4(b)의 eq Comparator가 Redundant -0를 검출함.",

      calc:
`Input == -0

→ TRUE`

    },


    {

      title:
        "SV_reg",

      value:
        `${sv > 0 ? "+" : ""}${sv}`,

      desc:
        "현재 Weight Group의 2-bit Metadata를 이용해 SV_reg의 Special Value 중 하나를 선택함.",

      calc:
`FP4 Special Values

-5
+5
-8
+8

Selected
→ ${sv > 0 ? "+" : ""}${sv}`

    },


    {

      title:
        "MUX",

      value:
`-0 → ${sv > 0 ? "+" : ""}${sv}`,

      desc:
        "eq 결과가 TRUE이므로 Redundant -0 대신 선택된 Special Value를 사용함.",

      calc:
`Stored Value = -0

Actual Value = ${sv}`

    },


    {

      title:
        "Fixed",

      value:
        fixed.text,

      desc:
        "선택된 Special Value를 Fixed-Point Representation으로 변환함.",

      calc:
`${sv}

↓

${fixed.text}`

    },


    {

      title:
        "LOD",

      value:

        fixed
          .terms
          .map(
            (v,index) =>
              `Term ${index+1} = ${v}`
          )
          .join("\n"),

      desc:
        "Special Value 역시 동일한 LOD를 통해 Bit-serial Term으로 Decode됨.",

      calc:
`${sv}

= ${termString}`

    },


    {

      title:
        "Result",

      value:
`${termString}

= ${sv}`,

      desc:
        "결국 -0 Encoding이 현재 Group에서 선택된 Special Value의 실제 numerical value로 계산됨.",

      calc:
`Stored Weight
= -0 Pattern

↓

SV_reg

↓

Actual Value
= ${sv}

↓

${termString}`

    }

  ];

}


/* =========================================================
   FP3
========================================================= */

function createFP3Data() {

  const raw =
    document
      .getElementById(
        "fp3-input"
      )
      .value;


  const isSpecial =
    raw.startsWith(
      "sv"
    );


  const value =
    Number(

      isSpecial
      ? raw.substring(2)
      : raw

    );


  const fixed =
    fixedPoint(value);


  const termString =
    fixed
      .terms
      .map(v =>

        (
          v > 0
          ? "+"
          : ""
        )

        + v

      )
      .join(" ");


  /* -----------------------------------------
     Basic FP3
  ------------------------------------------ */

  if (!isSpecial) {

    return [

      {

        title:
          "FP3 Value",

        value:
          value,

        desc:
          "Basic FP3 값이 입력됨.",

        calc:
`Basic FP3

{0, ±1, ±2, ±4}

Selected = ${value}`

      },


      {

        title:
          "FP3 ⊂ FP4",

        value:
`Same
Decoder`,

        desc:
          "Extended FP3 값은 FP4의 부분집합이므로 Figure 4(b)의 동일한 Decoder Hardware를 사용할 수 있음.",

        calc:
`FP3

↓

FP4 Decoder 재사용`

      },


      {

        title:
          "Fixed",

        value:
          fixed.text,

        desc:
          "FP4와 동일한 Sign-Magnitude Fixed-Point Representation으로 변환함.",

        calc:
`${value}

↓

S | I₃ I₂ I₁ I₀ | F₀

${fixed.text}`

      },


      {

        title:
          "LOD",

        value:

          fixed
            .terms
            .map(
              (v,index) =>
                `Term ${index+1} = ${v}`
            )
            .join("\n"),

        desc:
          "동일한 LOD Hardware를 사용하여 Bit-serial Term으로 Decode함.",

        calc:
`${value}

= ${termString}`

      },


      {

        title:
          "Result",

        value:
`${termString}

= ${value}`,

        desc:
          "FP3 역시 최종적으로 Unified Bit-serial Representation으로 전달됨.",

        calc:
`${termString}

↓

Sign / Exp / Man / Bsig`

      }

    ];

  }


  /* -----------------------------------------
     FP3 Special Value
  ------------------------------------------ */

  return [

    {

      title:
        "Stored FP3",

      value:
`Redundant
-0`,

      desc:
        "FP3에서도 Redundant -0 Encoding을 Special Value 표시로 재사용함.",

      calc:
`Stored Pattern

= Redundant -0`

    },


    {

      title:
        "-0 Check",

      value:
`eq =
TRUE`,

      desc:
        "Redundant -0를 검출하면 현재 Group에 할당된 FP3 Special Value를 선택함.",

      calc:
`-0 detected

↓

Select Special Value`

    },


    {

      title:
        "FP3 SV",

      value:
        `${value > 0 ? "+" : ""}${value}`,

      desc:
        "FP3의 Special Value는 ER의 ±3 또는 EA의 ±6임.",

      calc:
`FP3-ER → ±3

FP3-EA → ±6

Selected
= ${value}`

    },


    {

      title:
        "FP3 ⊂ FP4",

      value:
`Same
Decoder`,

      desc:
        "Special Value를 포함한 Extended FP3 값 역시 FP4 Decoder Hardware에서 처리함.",

      calc:
`${value}

↓

FP4-Compatible
Fixed Decoder`

    },


    {

      title:
        "Fixed",

      value:
        fixed.text,

      desc:
        "선택된 FP3 Special Value를 Fixed-Point 형태로 변환함.",

      calc:
`${value}

↓

${fixed.text}`

    },


    {

      title:
        "LOD",

      value:

        fixed
          .terms
          .map(
            (v,index) =>
              `Term ${index+1} = ${v}`
          )
          .join("\n"),

      desc:
        "LOD를 이용해 최대 두 개의 Bit-serial Term으로 분해함.",

      calc:
`${value}

= ${termString}`

    },


    {

      title:
        "Result",

      value:
`${termString}

= ${value}`,

      desc:
        "FP3 Special Value도 최종적으로 Unified Bit-serial Representation으로 전달됨.",

      calc:
`${termString}

↓

Sign / Exp / Man / Bsig`

    }

  ];

}


/* =========================================================
   UI
========================================================= */

let currentMode =
  "int8";


let currentStep =
  0;


const flow =
  document
    .getElementById(
      "bm-flow"
    );


const desc =
  document
    .getElementById(
      "bm-desc"
    );


const calc =
  document
    .getElementById(
      "bm-calc"
    );


const title =
  document
    .getElementById(
      "bm-step-title"
    );


const stepNumber =
  document
    .getElementById(
      "bm-step-number"
    );


/* =========================================================
   Current Data
========================================================= */

function currentData() {

  switch(
    currentMode
  ) {

    case "int8":

      return createIntegerData(8);


    case "int6":

      return createIntegerData(6);


    case "fp4":

      return createFP4Data();


    case "fp4sv":

      return createFP4SVData();


    case "fp3":

      return createFP3Data();

  }

}


/* =========================================================
   Control Visibility
========================================================= */

function updateControls() {

  document
    .getElementById(
      "int-control"
    )
    .style
    .display =

      (
        currentMode === "int8" ||
        currentMode === "int6"
      )

      ? "inline-flex"

      : "none";


  document
    .getElementById(
      "fp4-control"
    )
    .style
    .display =

      currentMode === "fp4"

      ? "inline-flex"

      : "none";


  document
    .getElementById(
      "fp4sv-control"
    )
    .style
    .display =

      currentMode === "fp4sv"

      ? "inline-flex"

      : "none";


  document
    .getElementById(
      "fp3-control"
    )
    .style
    .display =

      currentMode === "fp3"

      ? "inline-flex"

      : "none";


  const input =
    document
      .getElementById(
        "int-input"
      );


  if (
    currentMode === "int8"
  ) {

    input.min =
      -128;

    input.max =
      127;


    if (
      Number(input.value) < -128 ||
      Number(input.value) > 127
    ) {

      input.value =
        45;

    }

  }


  if (
    currentMode === "int6"
  ) {

    input.min =
      -32;

    input.max =
      31;


    if (
      Number(input.value) < -32 ||
      Number(input.value) > 31
    ) {

      input.value =
        21;

    }

  }

}


/* =========================================================
   Render
========================================================= */

function render(
  resetScroll = false
) {

  const data =
    currentData();


  if (
    currentStep >=
    data.length
  ) {

    currentStep =
      data.length - 1;

  }


  flow.innerHTML =
    "";


  data.forEach(
    (step,index) => {

      const box =
        document.createElement(
          "div"
        );


      box.className =
        "bm-box";


      if (
        index <
        currentStep
      ) {

        box
          .classList
          .add(
            "done"
          );

      }


      if (
        index ===
        currentStep
      ) {

        box
          .classList
          .add(
            "active"
          );

      }


      box.innerHTML = `

        <div class="bm-title">

          ${step.title}

        </div>

        <div class="bm-value">

          ${step.value}

        </div>

      `;


      flow.appendChild(
        box
      );


      if (
        index <
        data.length - 1
      ) {

        const arrow =
          document.createElement(
            "div"
          );


        arrow.className =
          "bm-arrow";


        if (
          index ===
          currentStep
        ) {

          arrow
            .classList
            .add(
              "active"
            );

        }


        arrow.textContent =
          "→";


        flow.appendChild(
          arrow
        );

      }

    }

  );


  const step =
    data[currentStep];


  stepNumber.textContent =

    `Step ${currentStep+1}/${data.length}`;


  title.textContent =
    step.title;


  desc.textContent =
    step.desc;


  calc.textContent =
    step.calc;


  /* -----------------------------------------
     탭 변경 시 반드시 맨 왼쪽부터 보여줌.

     FP4 -0 → SV에서
     Stored FP4가 잘리던 문제 해결.
  ------------------------------------------ */

  if (
    resetScroll
  ) {

    flow.scrollLeft =
      0;

  }


  /* -----------------------------------------
     현재 Step이 화면 밖으로 가면
     해당 Step이 보이도록 이동.
  ------------------------------------------ */

  requestAnimationFrame(
    () => {

      const active =
        flow.querySelector(
          ".bm-box.active"
        );


      if (
        active &&
        !resetScroll
      ) {

        const activeLeft =
          active.offsetLeft;


        const activeRight =
          activeLeft +
          active.offsetWidth;


        const visibleLeft =
          flow.scrollLeft;


        const visibleRight =
          visibleLeft +
          flow.clientWidth;


        if (
          activeLeft <
          visibleLeft + 15
        ) {

          flow.scrollTo({

            left:
              Math.max(
                0,
                activeLeft - 20
              ),

            behavior:
              "smooth"

          });

        }


        else if (
          activeRight >
          visibleRight - 15
        ) {

          flow.scrollTo({

            left:
              activeRight -
              flow.clientWidth +
              20,

            behavior:
              "smooth"

          });

        }

      }

    }
  );

}


/* =========================================================
   Tabs
========================================================= */

document
  .querySelectorAll(
    ".bm-tab"
  )
  .forEach(button => {

    button
      .addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".bm-tab"
            )
            .forEach(btn =>

              btn
                .classList
                .remove(
                  "active"
                )

            );


          button
            .classList
            .add(
              "active"
            );


          currentMode =
            button.dataset.mode;


          currentStep =
            0;


          updateControls();


          /*
            반드시 scrollLeft = 0부터
            새 Mode 표시
          */

          render(true);

        }
      );

  });


/* =========================================================
   Next
========================================================= */

document
  .getElementById(
    "bm-next"
  )
  .addEventListener(
    "click",
    () => {

      const data =
        currentData();


      if (
        currentStep <
        data.length - 1
      ) {

        currentStep++;

        render(false);

      }

      else {

        currentStep =
          0;

        render(true);

      }

    }
  );


/* =========================================================
   Previous
========================================================= */

document
  .getElementById(
    "bm-prev"
  )
  .addEventListener(
    "click",
    () => {

      currentStep =
        Math.max(
          0,
          currentStep - 1
        );


      render(false);

    }
  );


/* =========================================================
   Value Changes
========================================================= */

document
  .getElementById(
    "int-input"
  )
  .addEventListener(
    "input",
    () => {

      currentStep =
        0;

      render(true);

    }
  );


document
  .getElementById(
    "fp4-input"
  )
  .addEventListener(
    "change",
    () => {

      currentStep =
        0;

      render(true);

    }
  );


document
  .getElementById(
    "fp4sv-input"
  )
  .addEventListener(
    "change",
    () => {

      currentStep =
        0;

      render(true);

    }
  );


document
  .getElementById(
    "fp3-input"
  )
  .addEventListener(
    "change",
    () => {

      currentStep =
        0;

      render(true);

    }
  );


/* =========================================================
   Start
========================================================= */

updateControls();

render(true);

</script>

## B. BitMoD Processing Element

앞의 **Unified Bit-serial Representation**에서는 INT8, INT6, FP4, FP3 Weight를 모두 다음과 같은 공통 Bit-serial Term으로 변환했음.

$$
w=(w_s,w_e,w_m,w_{bsig})
$$

여기서

- $w_s$ : Weight Term의 Sign
- $w_e$ : Weight Term의 Exponent
- $w_m$ : 1-bit Mantissa
- $w_{bsig}$ : 원래 Weight에서 해당 Term이 가지는 Bit-significance

를 의미함.

하지만 BitMoD에서는 **Weight만 Low-Precision으로 Quantization하고 Activation은 FP16으로 유지**함.

따라서 실제 PE가 처리해야 하는 연산은

$$
\text{Bit-serial Low-Precision Weight}
\times
\text{FP16 Activation}
$$

이라는 **Mixed-Precision 연산**임.

이를 위해 BitMoD는 Figure 5와 같은 **Mixed-Precision Bit-serial Processing Element(PE)**를 제안함.

<center><img src="/images/PR/BitMoD/figure5.png" width = "1000"><br></center>

BitMoD PE는 한 Cycle마다

- 4개의 Bit-serial Weight Term
- 4개의 FP16 Activation

을 입력으로 받아 **4-way Dot Product**를 수행함.

전체 연산은 Figure 5의 흐름에 따라 크게 네 단계로 구성됨.

```text
Bit-serial Weight Terms
           +
    FP16 Activations
           │
           ▼
Step 1. Exponent Alignment
           │
           ▼
Step 2. Bit-serial Multiplication
           │
           ▼
Step 3. Group Accumulation
           │
           ▼
Step 4. Bit-serial Dequantization
           │
           ▼
Dequantized Group Partial Sum
```

### Weight와 Activation의 표현

Figure 5의 Weight는 앞의 Figure 4에서 생성된 Bit-serial Term임.

$$
w=(w_s,w_e,w_m,w_{bsig})
$$

반면 Activation은 FP16이므로 원래부터 Floating-Point 형식인

$$
a=(a_s,a_e,a_m)
$$

으로 구성됨.

즉 Activation에 새로운 Exponent를 만들어 저장하는 것이 아니라, **원래 FP16 Activation이 가지고 있던 Sign / Exponent / Mantissa를 그대로 사용하는 것**임.

FP16은 기본적으로

```text
FP16 Activation

┌──────┬────────────┬────────────────────┐
│ Sign │  Exponent  │      Fraction      │
│ 1bit │   5bit     │       10bit        │
└──────┴────────────┴────────────────────┘
```

형태임.

Mantissa 연산에서는 10-bit Fraction에 Hidden Bit를 포함하기 때문에 **11-bit Activation Mantissa**를 사용함.

즉 Figure 5의 PE 입력을 간단히 보면

```text
Weight Term
ws | we | wm | wbsig
          +
FP16 Activation
as | ae | am

        ↓

BitMoD PE
```

구조임.

### Step 1. Exponent Alignment

Figure 5의 첫 번째 단계에서는 각 Weight Term과 Activation을 곱했을 때 발생하는 **Product Exponent와 Sign을 먼저 계산함.**

Floating-Point 곱셈에서

$$
A=M_A2^{E_A}
$$

$$
W=M_W2^{E_W}
$$

라면

$$
A\times W
=
(M_AM_W)2^{E_A+E_W}
$$

가 됨.

따라서 Weight Term과 Activation의 Product Exponent는

$$
e_{product}=a_e+w_e
$$

Figure 5에서는 4개의 Weight-Activation Pair에 대해 이 연산을 동시에 수행함.

```text
Weight 0 + Activation 0
→ ae₀ + we₀

Weight 1 + Activation 1
→ ae₁ + we₁

Weight 2 + Activation 2
→ ae₂ + we₂

Weight 3 + Activation 3
→ ae₃ + we₃
```

하지만 이 네 Product를 이후 하나의 Dot Product로 더하려면 **Exponent를 동일하게 맞춰야 함.**

#### Exponent Alignment 예시

설명을 위해 네 Product의 Exponent가 다음과 같다고 가정함.

$$
[5,\;3,\;4,\;5]
$$

가장 큰 Exponent는

$$
e_{max}=5
$$

따라서 각 Product가 최대 Exponent와 얼마나 차이가 나는지 계산함.

$$
\delta e_i=e_{max}-e_i
$$

결과는

$$
\delta e=[0,\;2,\;1,\;0]
$$

```text
Product 0
Exponent = 5
δe = 0

Product 1
Exponent = 3
δe = 2

Product 2
Exponent = 4
δe = 1

Product 3
Exponent = 5
δe = 0
```

이 $\delta e$는 다음 Step의 Right Shifter가 각 Mantissa를 얼마나 Shift해야 하는지 결정함.

```text
ae + we
   ↓
Product Exponent
   ↓
4개 중 Maximum Exponent 탐색
   ↓
δe 계산
   ↓
Step 2의 Right Shift Amount
```

#### Product Sign 계산

Step 1에서는 Product Sign $y_s$도 함께 계산함.

Weight와 Activation의 Sign이 각각

$$
w_s,\qquad a_s
$$

라고 하면

$$
y_s=w_s\oplus a_s
$$

로 계산할 수 있음.

```text
Weight + × Activation + → +
Weight - × Activation + → -
Weight + × Activation - → -
Weight - × Activation - → +
```

따라서 Step 1에서는 크게

```text
Exponent
ae + we
   ↓
δe

Sign
as XOR ws
   ↓
ys
```

두 가지 정보를 생성함.

### Step 2. Bit-serial Multiplication

Step 2에서는 실제 Mantissa Multiplication을 수행함.

BitMoD의 Weight Term은 Figure 4에서 이미 단순한 Bit-serial Term으로 분해되어 있기 때문에 Weight Mantissa $w_m$은 **1-bit**임.

반면 FP16 Activation의 Mantissa $a_m$은 Hidden Bit를 포함하여 **11-bit**임.

따라서 실제 연산은

$$
1\text{-bit }w_m
\times
11\text{-bit }a_m
$$

#### Weight Mantissa가 1-bit인 이유

Bit-serial Term의 Mantissa는 사실상

$$
w_m\in\{0,1\}
$$

따라서

$$
w_m=0
$$

이면

$$
w_m\times a_m=0
$$

이고,

$$
w_m=1
$$

이면

$$
w_m\times a_m=a_m
$$

즉 일반적인 복잡한 Multiplier 대신 개념적으로

```text
wm = 0
→ Activation Mantissa 사용 안 함

wm = 1
→ Activation Mantissa 그대로 통과
```

처럼 처리할 수 있음.

### Right Shift를 통한 Exponent Alignment

Step 1에서 계산한 $\delta e$를 이용해 각 Product Mantissa를 Right Shift함.

앞의 예시에서

$$
\delta e=[0,2,1,0]
$$

이었음.

Activation Mantissa를

$$
[1.5,\;1.25,\;1.0,\;1.5]
$$

라고 가정하면 다음처럼 정렬됨.

#### Product 0

$$
\delta e=0
$$

이므로

$$
1.5\times2^{-0}=1.5
$$

#### Product 1

$$
\delta e=2
$$

이므로

$$
1.25\times2^{-2}=0.3125
$$

#### Product 2

$$
\delta e=1
$$

이므로

$$
1.0\times2^{-1}=0.5
$$

#### Product 3

$$
\delta e=0
$$

이므로

$$
1.5
$$

```text
Before Alignment

1.5      1.25      1.0      1.5
 ↓         ↓        ↓        ↓
shift 0  shift 2  shift 1  shift 0
 ↓         ↓        ↓        ↓
1.5     0.3125     0.5      1.5

        ↓

같은 Exponent 기준으로 정렬
```

### Rounding을 위한 3 Extra Bits

Right Shift를 수행하면 낮은 Bit가 잘려 나가면서 Rounding Error가 발생할 수 있음.

이를 처리하기 위해 BitMoD에서는 Shifter 결과에 **3개의 Extra Bit**를 추가함.

이 Extra Bit는 **Round-to-Nearest-Even**을 지원하기 위한 것임.

즉 Mantissa를 Shift하면서 발생하는 Precision Loss를 줄이기 위한 Hardware임.

### 4-way Adder Tree

Exponent가 맞춰진 네 개의 Mantissa Product는 이후 **Adder Tree**로 들어감.

```text
Product 0 ─┐
           ├── +
Product 1 ─┘     │
                 ├── + → Bit-serial Dot Product
Product 2 ─┐     │
           ├── +
Product 3 ─┘
```

즉 한 Cycle에서

$$
P
=
P_0+P_1+P_2+P_3
$$

형태의 **4-way Bit-serial Dot Product**를 계산함.

### Step 3. Group Accumulation

Step 2에서 계산한 것은 아직 **현재 Bit-serial Term에 대한 Dot Product**임.

하나의 원래 Weight는 여러 Bit-serial Term으로 나뉠 수 있기 때문에 각 Term의 결과를 다시 합쳐야 함.

예를 들어 Figure 4에서 FP4 값

$$
6
$$

은

$$
6=4+2
$$

의 두 Term으로 표현되었음.

따라서

```text
Cycle 1
Weight Term = 4
      ↓
Dot Product
      ↓
ACC에 저장


Cycle 2
Weight Term = 2
      ↓
Dot Product
      ↓
기존 ACC에 추가
```

하는 과정이 필요함.

이 역할을 Step 3의 **Group Accumulation**이 수행함.

### Bit-significance 적용

현재 Bit-serial Term이 원래 Weight에서 어느 위치를 나타내는지는

$$
w_{bsig}
$$

에 저장되어 있음.

예를 들어 Step 2의 Dot Product 결과가

$$
P=3
$$

이고 현재 Term의

$$
w_{bsig}=2
$$

라면 실제 Contribution은

$$
3\times2^2
$$

이므로

$$
12
$$

가 됨.

Hardware에서는 이를 일반 Multiplication 대신 Left Shift로 처리할 수 있음.

```text
Dot Product
     3
     │
     │ Bsig = 2
     ▼
   << 2
     │
     ▼
    12
```

### 기존 Accumulator와 합산

현재 결과는 기존 Accumulator Mantissa $m_{ACC}$와 더해짐.

예를 들어 기존 Accumulator가

$$
m_{ACC}=20
$$

이라면

$$
20+12=32
$$

가 됨.

```text
Current Dot Product
        3
        │
      Bsig=2
        │
        ▼
       12
        │
        │
mACC=20 │
    ────┘
        ↓
       ADD
        ↓
       32
```

이 과정을 여러 Bit-serial Term에 대해 반복함으로써 원래 Weight를 사용한 전체 Dot Product가 복원됨.

### Normalize와 Accumulator Exponent

Mantissa를 계속 더하면 Mantissa의 범위가 정규화 범위를 벗어날 수 있음.

따라서 Figure 5에서는 누적된 Mantissa를 **Normalize**하고 그에 맞게 Accumulator Exponent

$$
e_{ACC}
$$

를 갱신함.

즉 Step 3 이후에는

```text
Accumulated Mantissa
mACC
    +
Current Bit-serial Dot Product
    ↓
Normalize
    ↓
mACC / eACC 갱신
```

이 이루어짐.

이 결과가 해당 Weight Group의 **Group Partial Sum**이 됨.

### Step 4. Bit-serial Dequantization

BitMoD는 **Per-Group Quantization**을 사용하기 때문에 각 Group의 Dot Product가 끝난 뒤에는 해당 Group의 Scaling Factor를 적용해야 함.

즉 Group $g$의 Partial Sum을 $P_g$라고 하면

$$
P_g\Delta_g
$$

형태의 Dequantization이 필요함.

문제는 Group마다

$$
\Delta_1,\Delta_2,\Delta_3,\ldots
$$

가 서로 다르기 때문에 전체 Channel 연산이 끝날 때까지 Scaling을 미룰 수 없다는 것임.

따라서 Group 단위로 Dequantization을 수행해야 함.

### Section III-C와 연결

앞의 **Efficient Per-group Dequantization**에서 BitMoD가 Scaling Factor를 FP16이 아니라 **INT8로 다시 Quantization한 이유가 바로 Step 4 때문임.**

기존 방식이라면

$$
\text{Group Partial Sum}
\times
\text{FP16 Scaling Factor}
$$

가 필요하므로 Floating-Point Multiplier가 필요함.

BitMoD에서는 Scaling Factor를 INT8로 만들어

```text
FP16 Scaling Factor
        ↓
Second-Level Quantization
        ↓
INT8 Scaling Factor
```

형태로 사용함.

그러면 Scaling Factor를 한 번에 곱하지 않고 **한 Bit씩 Bit-serial 방식으로 처리할 수 있음.**

### INT8 Scaling Factor를 Bit-serial로 처리하는 예시

동작을 이해하기 위한 예시로 Scaling Factor의 Integer 값이

$$
\Delta_q=13
$$

이라고 가정함.

Binary로 표현하면

$$
13=00001101_2
$$

이고,

$$
13=8+4+1
$$

임.

따라서

$$
m_{ACC}\times13
$$

을 한 번에 계산하는 대신,

```text
INT8 Scaling Factor

00001101
       ↑
bit 단위로 순차 처리
```

할 수 있음.

각 Bit 위치를 보면

```text
bit 0 = 1
→ mACC × 1

bit 1 = 0
→ 0

bit 2 = 1
→ mACC × 4

bit 3 = 1
→ mACC × 8
```

이므로

$$
m_{ACC}\times13
=
m_{ACC}
+
(m_{ACC}<<2)
+
(m_{ACC}<<3)
$$

으로 계산할 수 있음.

즉 큰 FP Multiplier 대신

```text
mACC
 │
 ├─ Scaling bit = 1 → 사용
 ├─ Scaling bit = 0 → Skip
 ├─ Shift
 └─ Add
       ↓
Dequantized Partial Sum
```

방식을 사용함.

### 8-cycle Dequantization이 Bottleneck이 되지 않는 이유

Per-Group Scaling Factor는 INT8이므로 Bit를 하나씩 처리하면

$$
8\text{ cycles}
$$

이 필요함.

여기서

> **“Dequantization 때문에 PE Pipeline이 기다리는 것 아닌가?”**

라는 문제가 생길 수 있음.

하지만 논문에서는 Group Dot Product 자체가 훨씬 오래 걸리기 때문에 문제가 되지 않는다고 설명함.

BitMoD의 기본 Group Size는

$$
G=128
$$

이며 하나의 PE는 한 번에 4개의 Weight에 대해 Dot Product를 수행함.

따라서 Group의 Weight 128개를 처리하려면

$$
\frac{128}{4}=32
$$

번의 처리가 필요함.

가장 낮은 Precision인 FP3도 Weight 하나를 **2개의 Bit-serial Term**으로 처리하므로

$$
32\times2
=
64\text{ cycles}
$$

이 필요함.

즉,

```text
FP3 Group Dot Product

128 / 4 × 2
= 64 cycles


INT8 Scaling Factor Dequantization

= 8 cycles
```

따라서

$$
64\text{ cycles}
\gg
8\text{ cycles}
$$

이므로 Bit-serial Dequantization이 Computing Pipeline을 Stall시키지 않음.

---

### Precision에 따른 연산 Cycle 감소

BitMoD의 또 다른 장점은 **Weight Precision이 낮아질수록 처리해야 하는 Bit-serial Term의 개수가 감소한다는 것**임.

앞의 Figure 4에서

| Data Type | Bit-serial Term 수 |
|---|---:|
| INT8 | 4 |
| INT6 | 3 |
| FP4 | 2 |
| FP3 | 2 |

였음.

BitMoD PE에서는 각 Term을 Cycle 단위로 처리하기 때문에 4개의 MAC 연산을 수행하는 데 필요한 Cycle 수도 달라짐.

```text
INT8
4 Terms
→ 4 cycles

INT6
3 Terms
→ 3 cycles

FP4
2 Terms
→ 2 cycles

FP3
2 Terms
→ 2 cycles
```

따라서 INT6에서는

$$
\frac{4}{3}
\approx
1.33\times
$$

의 Throughput Improvement를 얻고,

FP4와 FP3에서는

$$
\frac{4}{2}
=
2\times
$$

의 Throughput Improvement를 얻을 수 있음.

즉 BitMoD에서 Low-Precision은 단순히 Weight Memory만 줄이는 것이 아니라 **실제 PE의 연산 Cycle까지 감소시킴.**

### PE Area 측면의 장점

논문에서는 이후 Hardware Evaluation을 통해 BitMoD PE가 일반 FP16 PE보다 **24% 적은 Area**를 사용한다고 설명함.

즉,

```text
Low Precision
     ↓
Bit-serial Term 수 감소
     ↓
연산 Cycle 감소

+

BitMoD PE 자체도
FP16 PE보다 작은 Area 사용
     ↓
같은 Compute Area에
더 많은 PE 배치 가능
```

이라는 추가적인 장점이 있음.

### Self-Attention 연산 지원

LLM에서는 Weight × Activation Matrix Multiplication뿐 아니라 Self-Attention 내부에서

$$
QK^T
$$

와

$$
PV
$$

처럼 **Activation Tensor끼리의 Matrix Multiplication**도 수행해야 함.

즉 Self-Attention에서는

```text
Query
Key
Value
```

세 개의 Activation Tensor가 사용됨.

하지만 BitMoD PE는 기본적으로

```text
한 Operand
→ FP16

다른 Operand
→ Low-Precision Bit-serial
```

형태의 Mixed-Precision 연산을 위해 설계됨.

따라서 세 Activation Tensor를 모두 FP16으로 유지하면서 계산하는 구조는 아님.

논문에서는 **Key와 Value Tensor가 Quantization에 비교적 강하다**는 기존 연구 결과를 이용함.

Key와 Value는

$$
INT8
$$

또는 심지어

$$
INT4
$$

까지 Quantization해도 Accuracy Loss가 매우 작다고 설명함.

따라서 Self-Attention에서는 개념적으로

```text
Query
→ FP16

Key
→ Low-Precision Integer

Value
→ Low-Precision Integer
```

형태로 처리할 수 있음.

이렇게 하면 기존 BitMoD Bit-serial PE를 Self-Attention 연산에도 활용할 수 있음.

### Figure 4와 Figure 5의 관계

Figure 4와 Figure 5는 서로 독립적인 구조가 아니라 **연속된 하나의 Data Path**임.

먼저 Figure 4에서

```text
INT8
INT6
FP4
FP3
 │
 ▼
Unified Bit-serial Representation
 │
 ▼
ws | we | wm | wbsig
```

을 생성함.

그리고 그 결과가 Figure 5의 PE 입력으로 들어감.

<center><img src="/images/PR/BitMoD/figure5.png" width = "1000"><br></center>

Figure 5에서는

```text
Figure 4 Output

Bit-serial Weight Term
ws | we | wm | wbsig

          +

FP16 Activation
as | ae | am

          ↓

       BitMoD PE

          ↓

Step 1
Exponent Alignment
ae + we
Sign 계산
          ↓

Step 2
wm × am
Right Shift
4-way Adder Tree
          ↓

Step 3
Bsig 적용
Group Accumulation
Normalize
          ↓

Step 4
INT8 Scaling Factor
Bit-serial Dequantization
          ↓

Dequantized
Group Partial Sum
```

순서로 처리됨.

BitMoD Processing Element의 핵심은 **Low-Precision Weight와 FP16 Activation 사이의 Mixed-Precision 연산을 Bit-serial 방식으로 수행하는 것**임.

특히 네 단계가 각각 다음 역할을 담당함.

| Step | 역할 |
|---|---|
| **Step 1** | Weight와 Activation의 Product Exponent 및 Sign 계산 |
| **Step 2** | 1-bit Weight Mantissa × 11-bit Activation Mantissa 연산 및 4-way Dot Product |
| **Step 3** | Bsig를 반영하여 여러 Bit-serial Term 결과를 Group 단위로 누적 |
| **Step 4** | INT8 Per-Group Scaling Factor를 이용해 Bit-serial Dequantization 수행 |

결국 BitMoD는

$$
\boxed{
\text{Low-Precision Weight}
\times
\text{FP16 Activation}
}
$$

을 하나의 PE에서 처리하면서 동시에

$$
\boxed{
\text{Per-Group Dequantization}
}
$$

까지 Hardware 내부에서 효율적으로 수행함.


## C. BitMoD Accelerator

앞의 Section IV-A에서는 여러 Low-Precision Weight를 **Unified Bit-serial Term**으로 변환하는 방법을 설명했고, Section IV-B에서는 해당 Term을 FP16 Activation과 계산하는 **BitMoD PE**를 설명했음.

<center><img src="/images/PR/BitMoD/figure6.png" width = "700"><br></center>

BitMoD Accelerator는 크게 다음 구조로 구성됨.

```text
Input Buffer
Weight Buffer
     │
     ▼
Bit-serial Term Generator
     │
     ▼
4 × 4 PE Tile Array
     │
     ▼
Local Output Buffer
+
Accumulator
     │
     ▼
Output Activation
```

### 1. Banked Input / Weight Buffer

BitMoD에서는 **Input Buffer와 Weight Buffer를 여러 Bank로 나누어 구성**함.

이는 많은 PE가 동시에 Input과 Weight에 접근할 때 충분한 Memory Bandwidth를 제공하기 위함임.

```text
Input Buffer                 Weight Buffer

Bank 0                       Bank 0
Bank 1                       Bank 1
Bank 2                       Bank 2
  ⋮                            ⋮
     ↓                          ↓
          Parallel Access
                ↓
              PE Array
```

즉 PE의 Parallelism이 높아지더라도 하나의 Buffer Access가 Bottleneck이 되지 않도록 하는 구조임.

### 2. Bit-serial Term Generator

Weight Buffer에서 읽어온 Weight는 바로 PE로 들어가는 것이 아니라 **Bit-serial Term Generator**를 거침.

### 3. PE Array 구조

BitMoD의 Main PE Array는

$$4\times4$$

개의 **PE Tile**로 구성되며, Tile들은 Systolic 방식으로 연결됨.

또한 하나의 PE Tile은

$$8\times8$$

개의 PE로 구성됨.

따라서 구조적으로는

```text
Main PE Array
4 × 4 Tiles

┌────────┬────────┬────────┬────────┐
│ Tile   │ Tile   │ Tile   │ Tile   │
├────────┼────────┼────────┼────────┤
│ Tile   │ Tile   │ Tile   │ Tile   │
├────────┼────────┼────────┼────────┤
│ Tile   │ Tile   │ Tile   │ Tile   │
├────────┼────────┼────────┼────────┤
│ Tile   │ Tile   │ Tile   │ Tile   │
└────────┴────────┴────────┴────────┘

Tile 하나
      ↓
8 × 8 PEs
```

전체 PE 수는

$$
4\times4\times8\times8
=
1024
$$

### 4. Output-Stationary Dataflow

각 PE Tile은 **Output-Stationary Dataflow**를 사용함.

Matrix Multiplication의 하나의 Output은

$$
Y_{ij}
=
\sum_k W_{ik}A_{kj}
$$

처럼 여러 Multiplication 결과를 계속 누적해서 생성됨.

Output-Stationary 방식에서는 이 중간 결과인 **Partial Sum을 PE 내부에 유지**하고 Weight와 Input을 계속 공급함.

```text
W × A
  ↓
Partial Sum
  ↓
+ W × A
  ↓
Partial Sum
  ↓
+ W × A
  ↓
  ...
  ↓
Final Output
```

즉 Partial Sum을 매번 Buffer로 내보냈다가 다시 읽는 동작을 줄일 수 있음.

### 5. Weight와 Input의 Broadcast

Figure 6에서 중요한 부분은 **Weight와 Input이 서로 다른 방향으로 Broadcast된다는 것**임.

- **Bit-serial Weight Term → PE Column 전체로 Broadcast**
- **Input → PE Row 전체로 Broadcast**

```text
                Weight
                  ↓
          W0      W1      W2
          ↓       ↓       ↓

A0 →     [PE]    [PE]    [PE]

A1 →     [PE]    [PE]    [PE]

A2 →     [PE]    [PE]    [PE]

↑
Input은 Row 방향으로 전달
```

즉 하나의 Weight Term은 같은 Column의 여러 PE에서 재사용되고, 하나의 Input은 같은 Row의 여러 PE에서 재사용됨.

### 6. Weight-sharing / Input-sharing

위의 Broadcast 구조를 통해 BitMoD는 두 종류의 Data Reuse를 얻음.

#### Weight-sharing

같은 Weight Term을 Column 전체에서 공유함.

```text
Weight W0
   ↓
┌─────┐
│ PE  │
├─────┤
│ PE  │
├─────┤
│ PE  │
├─────┤
│ PE  │
└─────┘
```

Weight를 PE마다 Memory에서 따로 읽을 필요가 없음.

#### Input-sharing

같은 Input Activation을 Row 전체에서 공유함.

```text
Input A0
   ↓
[PE] → [PE] → [PE] → [PE]
```

따라서 하나의 Input 역시 여러 PE에서 재사용할 수 있음.

결과적으로

$$
\boxed{\text{Weight-sharing + Input-sharing}}
$$

을 통해 Memory Access를 줄이면서 PE의 Parallelism을 유지할 수 있음.

### 7. Local Output Buffer와 Accumulator

각 **PE Column에는 Local Output Buffer와 Accumulator**가 존재함.

BitMoD는 Per-Group Quantization을 사용하기 때문에 Figure 5의 PE가 계산하는 결과는 전체 Channel Output이 아니라 **Group 단위의 Partial Sum**임.

예를 들어 하나의 Channel이 여러 Group으로 나뉘어 있다면

```text
Group 0
→ PE
→ Partial Sum P0

Group 1
→ PE
→ Partial Sum P1

Group 2
→ PE
→ Partial Sum P2

Group 3
→ PE
→ Partial Sum P3
```

가 생성됨.

최종 Per-Channel Output은 이 결과들을 다시 합쳐야 함.

$$
Y=P_0+P_1+P_2+P_3
$$

따라서 Column의 Accumulator에서

```text
P0
 ↓
ACC = P0
 ↓
+ P1
 ↓
ACC = P0 + P1
 ↓
+ P2
 ↓
ACC = P0 + P1 + P2
 ↓
...
 ↓
Final Per-Channel Output
```

### 8. Shared Accumulator를 하나만 사용하는 이유

논문에서는 PE Column 전체가 **하나의 Accumulator를 공유**하도록 설계함.

이는 하나의 Weight Group을 계산하는 데 많은 Cycle이 필요하기 때문임.

즉 새로운 Group Partial Sum이 매 Cycle마다 계속 생성되는 것이 아니므로, 한 Group을 처리하는 동안 하나의 Accumulator가 Column의 결과들을 순차적으로 처리할 충분한 시간이 존재함.

```text
PE 0 ─┐
PE 1 ─┤
PE 2 ─┼──→ Shared Accumulator
PE 3 ─┤
 ...  ─┘
```

따라서 PE마다 별도의 Accumulator를 배치하지 않아도 됨.

```text
PE마다 ACC 사용

PE0 → ACC0
PE1 → ACC1
PE2 → ACC2

        ↓

Hardware Cost 증가
```

대신

```text
여러 PE
   ↓
Shared ACC 하나
```

를 사용함으로써 **Accumulator Hardware Overhead를 줄임.**

BitMoD Accelerator는 **4×4 PE Tile Array**로 구성되고, 각 Tile은 **8×8 BitMoD PE**를 포함함.

또한

$$
\boxed{\text{Weight Term → Column Broadcast}}
$$

$$
\boxed{\text{Input → Row Broadcast}}
$$

방식을 사용하여 Weight-sharing과 Input-sharing을 동시에 활용함.

각 PE는 Figure 5에서 설명한 방식으로 Group Partial Sum을 계산하고, PE Column의 Shared Accumulator가 여러 Group의 Partial Sum을 누적하여 최종 **Per-Channel Output Activation**을 생성함.

즉 BitMoD의 전체 Hardware 흐름은

$$
\boxed{
\text{Quantized Weight}
\rightarrow
\text{Bit-serial Term}
\rightarrow
\text{BitMoD PE}
\rightarrow
\text{Group Partial Sum}
\rightarrow
\text{Channel Output}
}
$$

으로 정리할 수 있음.

핵심은 단순히 PE의 개수를 늘리는 것이 아니라, **Bit-serial Weight Representation + Systolic PE Array + Weight/Input Data Reuse + Shared Accumulator**를 결합하여 Low-Precision LLM 연산을 Hardware 효율적으로 수행하는 것임.

# ◼︎ Evaluation

BitMoD의 Evaluation에서는 크게

1. **Low-Precision Quantization의 Model Accuracy**
2. **Accelerator의 Speedup / Energy Efficiency**
3. **Bit-serial Architecture의 Hardware Efficiency**
4. **기존 Quantization 기법과의 결합 가능성**

을 평가함.

## A. Experimental Methodology

총 6개의 LLM을 대상으로 평가함.

- OPT-1.3B
- Phi-2B
- Yi-6B
- Llama-2-7B
- Llama-2-13B
- Llama-3-8B

Task는 두 종류로 나눔.

### Discriminative Tasks

Zero-shot 환경에서 다음 Benchmark의 Accuracy를 측정함.

- HellaSwag
- WinoGrande
- PIQA

### Generative Tasks

다음 Dataset에서 **Perplexity(PPL)**를 측정함.

- Wikitext-2
- C4

비교 대상은 ANT, OliVe, Microscaling(MX), Per-group Asymmetric Integer Quantization 등임.

Hardware는 SystemVerilog RTL로 구현하고 **TSMC 28nm 공정**으로 합성함.  
End-to-End Performance는 Cycle-level Simulator를 이용해 평가하며, 모든 Accelerator는 동일한 Compute Area 조건에서 비교함.

## B. Model Accuracy

### 4-bit Quantization

BitMoD는 4-bit Weight Quantization에서 FP16 대비 Accuracy와 Perplexity 저하가 매우 작았음.

Discriminative Task에서는 평균 Accuracy Loss가

$$
<0.5\%
$$

수준으로 유지됨.

Generative Task에서도 평균 Perplexity 증가가

$$
<0.5
$$

수준임.

즉 **4-bit에서는 FP16과 거의 유사한 Model Quality를 유지할 수 있음.**

### 3-bit Quantization

3-bit로 Precision을 더 낮추면 기존 방식들의 성능 저하가 크게 증가함.

특히 ANT, OliVe, MX 및 INT3-Asym과 비교했을 때 BitMoD가 더 낮은 Perplexity를 유지함.

```text
기존 3-bit Quantization
        ↓
Quantization Error 크게 증가
        ↓
Model Quality 감소

BitMoD
        ↓
Group별로 적절한 Special Value 선택
        ↓
Range / Resolution 보완
        ↓
Quantization Error 감소
```

Generative Task에서 BitMoD의 평균 Perplexity Loss는 FP16 대비

$$
<3
$$

수준으로 유지됨.

따라서 **BitMoD의 장점은 Precision이 매우 낮아지는 3-bit 환경에서 더욱 크게 나타남.**

### Data Type Adaptation의 효과

Basic FP3/FP4 하나만 사용하는 것보다

- Extended Range
- Extended Resolution

을 Group별로 선택하는 BitMoD가 더 좋은 결과를 보임.

즉

```text
하나의 고정 Data Type
        ↓
모든 Weight Group에 동일하게 적용

BitMoD
        ↓
각 Group Distribution에 맞춰
Special Value 선택
        ↓
더 낮은 Quantization Error
```

가 됨.

이는 **Fine-grained Data Type Adaptation이 실제 Model Accuracy 개선으로 이어짐**을 보여줌.

## C. Accelerator Performance

BitMoD는 Low-Precision Weight를 사용함으로써

1. Weight Memory Traffic 감소
2. Bit-serial PE의 연산 Cycle 감소

두 가지 효과를 동시에 얻음.

특히 Memory-bound인 Generative Task에서는 Weight Precision 감소에 따른 Memory Traffic 감소 효과가 크게 나타남.

### FP16 Baseline 대비

Lossless BitMoD는 FP16 Accelerator 대비 평균적으로

- **Discriminative Task : 1.99× Speedup**
- **Generative Task : 2.41× Speedup**

을 달성함.

즉 Model Accuracy를 거의 유지하면서도 상당한 성능 향상을 얻음.

### ANT / OliVe 대비

Accuracy Loss를 허용하여 더 낮은 Precision을 사용하는 설정에서는 BitMoD가 ANT와 OliVe보다 더 높은 성능을 보임.

논문의 전체 평균 결과에서 BitMoD는

$$
\boxed{1.69\times}
$$

ANT 대비 Speedup,

$$
\boxed{1.48\times}
$$

OliVe 대비 Speedup을 달성함.

이러한 차이는 BitMoD가 **Per-group Quantization을 사용하면서도 매우 낮은 Weight Precision을 안정적으로 사용할 수 있기 때문**임.

## D. Energy Efficiency & Hardware Efficiency

BitMoD의 Energy Saving은 주로 두 부분에서 발생함.

```text
Low-Precision Weight
        ↓
DRAM Weight Traffic 감소

+

Bit-serial PE
        ↓
Compute Energy 감소
```

FP16 Baseline과 비교하면 BitMoD는 전체 Task에서 평균

$$
\boxed{2.31\times}
$$

더 높은 Energy Efficiency를 달성함.

기존 Accelerator와 비교하면

- ANT 대비 **1.48×**
- OliVe 대비 **1.31×**

더 높은 Energy Efficiency를 보임.

### Bit-serial PE의 장점

기존 Bit-parallel 방식에서는 여러 Precision을 지원하기 위해 추가 Hardware가 필요함.

예를 들어 INT8과 INT4를 동시에 지원하려면 별도의 연산 경로나 Accumulator가 추가되어 Area와 Power가 증가할 수 있음.

반면 BitMoD는

```text
INT8 → 4 Terms
INT6 → 3 Terms
FP4  → 2 Terms
FP3  → 2 Terms
```

처럼 **같은 PE를 사용하면서 처리 Cycle만 변경**함.

따라서 하나의 Hardware로 다양한 Precision을 지원하면서 Area Overhead를 줄일 수 있음.

BitMoD PE는 일반 FP16 PE보다 약 **24% 적은 Area**를 사용함.

## E. Combining BitMoD with Other Quantization Schemes

BitMoD의 Data Type은 기존 Software Quantization 기법과도 결합할 수 있음.

논문에서는 다음 기법과 결합하여 평가함.

- AWQ
- OmniQuant
- SmoothQuant

핵심은 기존 Quantization Algorithm을 모두 바꾸는 것이 아니라,

```text
기존 방식

Weight Optimization
        ↓
INT Quantizer


BitMoD 결합

Weight Optimization
        ↓
BitMoD FP4 / FP3 Quantizer
```

처럼 **기존 Integer Quantizer를 BitMoD Data Type으로 교체하는 것**임.

### AWQ / OmniQuant와 결합

BitMoD를 OmniQuant에 적용했을 때 기존 OmniQuant 대비 평균 Perplexity Loss가

- 4-bit : **28% 감소**
- 3-bit : **31% 감소**

함.

또한 BitMoD + AWQ / OmniQuant는 4-bit뿐 아니라 **3-bit에서도 평균 Perplexity Loss를 1 이하 수준까지 낮춤.**

즉 BitMoD의 Data Type 설계와 기존 Quantization Optimization은 서로 경쟁하는 방식이 아니라 **함께 사용할 수 있는 Orthogonal한 기법**임.

### SmoothQuant와 결합

SmoothQuant를 사용해 Activation을 INT8로 Quantization한 경우에도 BitMoD Weight Quantization의 장점이 유지됨.

따라서 BitMoD는

```text
Weight
→ FP4 / FP3 BitMoD

Activation
→ FP16
또는
→ INT8 SmoothQuant
```

과 같이 Weight-only Quantization뿐 아니라 Activation Quantization과도 결합 가능함.

| 항목 | 결과 |
|---|---|
| **4-bit Accuracy** | FP16 대비 평균 Accuracy Loss < 0.5% |
| **4-bit Generative** | 평균 PPL Loss < 0.5 |
| **3-bit Generative** | 평균 PPL Loss < 3 |
| **FP16 대비 Speedup** | 1.99× Discriminative / 2.41× Generative |
| **ANT 대비 Speedup** | 평균 1.69× |
| **OliVe 대비 Speedup** | 평균 1.48× |
| **FP16 대비 Energy Efficiency** | 2.31× |
| **ANT 대비 Energy Efficiency** | 1.48× |
| **OliVe 대비 Energy Efficiency** | 1.31× |
| **BitMoD PE Area** | FP16 PE 대비 약 24% 감소 |

결국 BitMoD는 단순히 Weight Precision을 낮추는 것이 아니라,

$$
\boxed{
\text{Model Accuracy}
+
\text{Low-Precision Memory Saving}
+
\text{Bit-serial Hardware Efficiency}
}
$$

를 동시에 확보함.

특히 **3-bit와 같이 매우 낮은 Precision에서도 기존 방식보다 Model Quality를 잘 유지하면서 실제 Hardware Speedup과 Energy Saving까지 얻는 것**이 Evaluation의 핵심 결과임.