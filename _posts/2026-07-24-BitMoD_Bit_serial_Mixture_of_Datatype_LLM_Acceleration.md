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