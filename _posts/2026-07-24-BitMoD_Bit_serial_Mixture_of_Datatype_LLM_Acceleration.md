---
layout: single
title: "BitMoD Bit-serial Mixture-of-Datatype LLM Acceleration, HPCA 2025"
categories: Paper_review
tags: PR
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
