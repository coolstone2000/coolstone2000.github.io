---
layout: single
classes: signals-systems-post
title: "Signals and Systems & Digital Signal Processing"
categories: Math
tags: ["Math", "Signals and Systems", "DSP", "Fourier", "Sampling", "Convolution", "Z Transform", "FFT", "Digital Filter", "Quantization"]
toc: true
author_profile: false
comments: true
---

# 신호와 시스템 · 디지털 신호처리

공업수학에서 미분방정식, 선형대수, 복소수, 푸리에 급수, 푸리에 변환, 라플라스 변환을 배웠다면 이제 질문이 바뀐다.

> **그 수학을 실제 전자공학 신호에 어떻게 쓰는가?**

마이크가 만든 전압은 시간에 따라 변하는 함수다. 센서의 출력도 함수이고, 통신 안테나가 받는 전압도 함수다. ADC를 지나면 이 함수는 숫자의 열이 된다. 필터는 이 신호를 바꾸고, 통신기는 신호에 정보를 싣고, DSP는 원하는 성분을 남기고 나머지를 줄인다.

이 과목의 전체 흐름은 다음과 같다.

$$
\boxed{
\text{물리량}
\longrightarrow
\text{신호}
\longrightarrow
\text{시스템}
\longrightarrow
\text{LTI}
\longrightarrow
\text{주파수 해석}
\longrightarrow
\text{샘플링}
\longrightarrow
\text{DSP}
}
$$

앞에서 배운 공업수학은 여기서 다음처럼 다시 등장한다.

| 공업수학 | 신호와 시스템에서의 역할 |
|---|---|
| 미분방정식 | 회로와 시스템의 시간응답 모델 |
| 선형대수 | 상태공간, DFT, 직교기저 |
| 복소수 | 진폭과 위상, 복소지수 |
| 푸리에 급수 | 주기신호의 주파수 성분 |
| 푸리에 변환 | 비주기신호의 스펙트럼 |
| 라플라스 변환 | 전달함수, 극점, 과도응답 |
| 수열과 급수 | 이산시간 시스템과 차분방정식 |

---

> **읽는 방법** — 어려운 개념은 먼저 일상적인 말로 설명하고, 작은 예제로 확인한 다음, 그 설명을 수식으로 옮긴다. 비유 자체를 증명으로 대신하지 않는다. 마지막의 **직접 설명해 보기**에 답할 수 없다면 그 앞의 유도에서 연결이 끊긴 곳을 다시 읽자. 정의는 우리가 정한 약속이고, 성질과 정리는 그 약속 및 가정에서 증명해야 하는 결과다.

# Part I. 신호

## 0. 왜 신호와 시스템을 배우는가?

전자공학에서 중요한 장치는 대부분 입력을 받아 출력을 만든다.

$$
\boxed{
x
\xrightarrow{\mathcal{T}}
y
}
$$

여기서 $x$는 입력신호, $y$는 출력신호, $\mathcal{T}$는 시스템이다.

예를 들어 마이크부터 스피커까지의 흐름은 다음과 같다.

$$
\text{음압}
\rightarrow
\text{마이크 전압}
\rightarrow
\text{ADC}
\rightarrow
\text{디지털 필터}
\rightarrow
\text{DAC}
\rightarrow
\text{스피커}
$$

이 과목에서 계속 답하려는 질문은 크게 네 가지다.

1. 신호를 어떤 수학적 함수로 표현할까?
2. 시스템이 신호를 어떻게 바꾸는가?
3. 시간영역에서 복잡한 계산을 주파수영역에서 더 쉽게 할 수 있는가?
4. 연속 신호를 디지털 숫자로 바꿀 때 무엇을 잃고 무엇을 보존하는가?

{% include signals-systems-visual.html kind="signal-flow" title="신호가 전자 시스템을 통과하는 전체 흐름" %}

---

## 1. 신호란 무엇인가?

### 1.1 신호의 정의

신호(signal)는 독립변수에 따라 어떤 물리량이나 정보를 나타내는 함수다.

시간에 따라 변하는 전압은

$$
x(t)
$$

라고 쓸 수 있다.

온도센서 출력도 $x(t)$, 마이크 전압도 $x(t)$, ECG도 $x(t)$로 나타낼 수 있다.

그러나 모든 신호가 시간만을 독립변수로 가지는 것은 아니다. 흑백영상은

$$
x[m,n]
$$

처럼 가로와 세로 두 개의 이산 좌표를 갖는다.

따라서 신호를 더 일반적으로 보면

$$
\boxed{
\text{신호}
=
\text{독립변수에 정보를 대응시키는 함수}
}
$$

이다.

---

### 1.2 왜 함수를 사용하나?

함수로 표현하면 다음을 계산할 수 있다.

- 신호의 순간값
- 평균값
- 에너지와 전력
- 주기
- 주파수 성분
- 시스템을 통과한 출력
- 다른 신호와의 유사도

즉 실제 파형을 수학적 대상으로 바꾸는 순간 미적분, 선형대수, 복소수, 푸리에 해석을 사용할 수 있다.

---

### 1.3 예제: 마이크 신호

마이크 출력이

$$
x(t)=0.2\cos(2\pi\cdot440t)
$$

라고 하자.

이 식에서

- 진폭은 $0.2$
- 주파수는 $440\,\mathrm{Hz}$
- 주기는 $1/440\,\mathrm{s}$

이다.

즉 하나의 함수에서 물리적 특성을 바로 읽을 수 있다.

---

## 2. 연속시간 신호와 이산시간 신호

### 2.1 연속시간 신호

연속시간 신호는 모든 실수 시간 $t$에서 정의된다.

$$
\boxed{x(t)}
$$

예:

$$
x(t)=\cos(2\pi t)
$$

---

### 2.2 이산시간 신호

이산시간 신호는 정수 인덱스 $n$에서만 정의된다.

$$
\boxed{x[n]}
$$

예:

$$
x[n]=\cos(0.2\pi n)
$$

대괄호는 단순한 표기 차이가 아니라 **독립변수가 정수라는 사실**을 강조한다.

---

### 2.3 샘플링으로 연결

연속시간 신호 $x(t)$를 $T_s$초 간격으로 읽으면

$$
\boxed{
x[n]=x(nT_s)
}
$$

가 된다.

여기서

$$
f_s=\frac{1}{T_s}
$$

를 샘플링 주파수라 한다.

{% include signals-systems-visual.html kind="ct-dt" title="연속시간 신호와 이산시간 샘플" %}

---

## 3. 연속시간과 아날로그는 같은 말이 아니다

많이 헷갈리는 부분이다.

신호는 두 축으로 구분할 수 있다.

### 시간축

- 연속시간
- 이산시간

### 진폭축

- 연속진폭
- 양자화된 진폭

따라서 다음처럼 구분할 수 있다.

| 시간 | 진폭 | 예 |
|---|---|---|
| 연속 | 연속 | 이상적인 아날로그 전압 |
| 이산 | 연속 | ADC의 샘플링 직후 이상모델 |
| 이산 | 이산 | 실제 디지털 데이터 |

즉

$$
\boxed{
\text{샘플링}
\ne
\text{양자화}
}
$$

이다.

샘플링은 **시간축을 이산화**하고, 양자화는 **진폭축을 이산화**한다.

---

## 4. 기본 신호

기본 신호를 배우는 이유는 복잡한 신호를 이 신호들의 조합으로 표현할 수 있기 때문이다.

### 4.1 상수 신호

$$
x(t)=A
$$

시간에 따라 값이 변하지 않는다. 전자회로에서 일정한 DC 전압을 표현할 수 있다.

{% include signals-systems-visual.html kind="constant" title="상수 신호: 변하지 않는 진폭" %}

### 4.2 단위 계단 신호

$$
u(t)=
\begin{cases}
0, & t<0,\\
1, & t>0
\end{cases}
$$

특정 시각부터 입력이 켜지는 상황을 표현한다. $u(0)$은 0, 1/2, 1 등 관례를 정해서 쓴다. 한 점의 값은 보통의 적분값에 영향을 주지 않지만, 불연속점에서 임펄스와의 곱은 별도 정의에 주의해야 한다.

예를 들어 $t=2$에서 $5\,\mathrm{V}$가 켜지면

$$
x(t)=5u(t-2)
$$

이다.

{% include signals-systems-visual.html kind="step" title="단위 계단: 입력이 켜지는 시각" %}

### 4.3 단위 임펄스

Dirac 임펄스 $\delta(t)$의 핵심 성질은

$$
\boxed{
\int_{-\infty}^{\infty}\delta(t)\,dt=1
}
$$

과

$$
\boxed{
\int_{-\infty}^{\infty}
x(t)\delta(t-t_0)\,dt
=
x(t_0)
}
$$

이다.

Dirac 임펄스는 유한한 높이를 가진 보통 함수가 아니라 분포이다. 위 추출 성질은 $x$가 $t_0$에서 연속인 경우 등 적절한 조건에서 읽는다. 이산시간의 $\delta[n]$과는 다르다.

왜 배우는가? LTI 시스템에 $\delta(t)$를 넣었을 때의 출력 $h(t)$만 알면 그 시스템의 모든 입력에 대한 출력을 구할 수 있기 때문이다.

{% include signals-systems-visual.html kind="impulse" title="Dirac 임펄스: 높이가 아니라 면적" %}

### 4.4 램프 신호

$$
r(t)=t\,u(t)
$$

이고

$$
\frac{d}{dt}r(t)=u(t)
$$

이다.

또 분포의 의미에서

$$
\frac{d}{dt}u(t)=\delta(t)
$$

이다.

따라서

$$
\boxed{
r(t)
\xrightarrow{\frac{d}{dt}}
u(t)
\xrightarrow{\frac{d}{dt}}
\delta(t)
}
$$

이다.

{% include signals-systems-visual.html kind="ramp" title="램프: 일정한 기울기로 증가" %}

### 4.5 실수 지수신호

$$
x(t)=e^{at}
$$

에서

- $a<0$: 감쇠
- $a=0$: 상수
- $a>0$: 성장

이다.

여기서 감쇠·성장은 $t$가 증가하는 방향의 설명이다. $e^{at}$는 모든 실수 시간에 정의한 신호이고, $e^{at}u(t)$는 0부터 켜진 신호다. 인과적 시스템의 자연모드에서 고유값의 실수부가 감쇠·성장을 결정하는 것과 연결된다.

{% include signals-systems-visual.html kind="exp" title="실수 지수: 감쇠와 성장" %}

### 4.6 복소 지수신호

$$
x(t)=e^{j\omega t}
$$

이고 Euler 공식에 의해

$$
\boxed{
e^{j\omega t}
=
\cos(\omega t)+j\sin(\omega t)
}
$$

이다.

복소지수는 사인과 코사인을 한 번에 표현한다.

{% include signals-systems-visual.html kind="complex-exp" title="복소 지수: 회전과 두 성분" %}

### 4.7 사인파

$$
\boxed{
x(t)=A\cos(\omega_0t+\phi)
}
$$

여기서

$$
\omega_0=2\pi f_0,
\qquad
T_0=\frac{1}{f_0}
$$

이다.

왜 $2\pi$인가? 사인과 코사인의 한 주기가 각도로 $2\pi$이기 때문이다.

{% include signals-systems-visual.html kind="sin" title="사인파: 주파수와 위상" %}

---

## 5. 신호의 기본 연산

### 5.1 진폭 스케일링

$$
y(t)=Ax(t)
$$

{% include signals-systems-visual.html kind="amplitude" title="진폭 스케일링: 시간축은 그대로" %}

### 5.2 시간 이동

$$
y(t)=x(t-t_0)
$$

은 오른쪽으로 $t_0$만큼 이동한다.

{% include signals-systems-visual.html kind="time-shift" title="시간 이동: 지연과 앞당김" %}

### 5.3 시간 반전

$$
y(t)=x(-t)
$$

는 좌우 반전이다.

{% include signals-systems-visual.html kind="time-reverse" title="시간 반전: 비대칭 신호를 뒤집기" %}

### 5.4 시간 스케일링

$$
y(t)=x(at)
$$

에서

- $\lvert a\rvert>1$: 압축
- $0<\lvert a\rvert<1$: 확대
- $a<0$: 시간반전 포함

이다.

{% include signals-systems-visual.html kind="time-scale" title="시간 스케일링: 압축과 확대" %}

### 5.5 복합변환

$$
y(t)=x(2t-4)
=
x(2(t-2))
$$

와 같은 식은 특징점의 위치를 방정식으로 추적하는 것이 안전하다.

원래 특징점이 $t=t_0$이었다면

$$
2t-4=t_0
$$

이므로 새 위치는

$$
t=\frac{t_0+4}{2}
$$

이다.

{% include signals-systems-visual.html kind="transform" title="시간 이동 · 반전 · 스케일링" %}

---

## 6. 신호의 분류

### 6.1 연속시간 주기신호

어떤 $T_0>0$가 존재하여

$$
x(t+T_0)=x(t)
$$

이면 주기신호다.

### 6.2 이산시간 주기신호

어떤 양의 정수 $N_0$가 존재하여

$$
x[n+N_0]=x[n]
$$

이면 주기신호다.

### 6.3 이산시간 복소지수의 주기 조건

$$
x[n]=e^{j\omega_0n}
$$

이 주기적이려면

$$
e^{j\omega_0N}=1
$$

이어야 하므로

$$
\omega_0N=2\pi k
$$

인 정수 $k$가 존재해야 한다.

즉

$$
\boxed{
\frac{\omega_0}{2\pi}
\text{가 유리수일 때 주기적이다}
}
$$

이다.

### 6.4 짝·홀 분해

짝신호:

$$
x(-t)=x(t)
$$

홀신호:

$$
x(-t)=-x(t)
$$

모든 신호는

$$
x(t)=x_e(t)+x_o(t)
$$

로 분해 가능하며

$$
x_e(t)=\frac{x(t)+x(-t)}{2}
$$

$$
x_o(t)=\frac{x(t)-x(-t)}{2}
$$

이다.

---

## 7. 에너지 신호와 전력 신호

### 7.1 에너지

$$
\boxed{
E_x=
\int_{-\infty}^{\infty}
\lvert x(t)\rvert^2\,dt
}
$$

에너지 신호는 $0<E_x<\infty$이고 평균전력은 0이다. 아래 평균전력의 극한이 존재하고 $0<P_x<\infty$인 경우를 전력 신호라 한다. 모든 신호가 이 둘 중 하나에 속하는 것은 아니다.

### 7.2 평균전력

$$
\boxed{
P_x=
\lim_{T\to\infty}
\frac{1}{2T}
\int_{-T}^{T}
\lvert x(t)\rvert^2\,dt
}
$$

전압이 저항 $R$에 걸리면 순간전력은 $v^2/R$이므로 제곱이 실제 물리량과 직접 연결된다.

### 예제: 유한 펄스

$$
x(t)=
\begin{cases}
A,&0<t<T_0,\\
0,&\text{그 외}
\end{cases}
$$

이면

$$
E_x=A^2T_0
$$

이다.

### 예제: 사인파

$$
x(t)=A\cos(\omega_0t)
$$

에서 $A\ne0$, $\omega_0\ne0$라면 총에너지는 무한하지만 평균전력은

$$
\boxed{
P_x=\frac{A^2}{2}
}
$$

이다.

---

## 8. 이산시간 기본 신호

### 8.1 단위샘플

$$
\delta[n]=
\begin{cases}
1,&n=0,\\
0,&n\ne0
\end{cases}
$$

{% include signals-systems-visual.html kind="dt-impulse" title="이산 단위샘플 δ[n]" %}

### 8.2 단위계단

$$
u[n]=
\begin{cases}
1,&n\ge0,\\
0,&n<0
\end{cases}
$$

{% include signals-systems-visual.html kind="dt-step" title="이산 단위계단 u[n]" %}

둘 사이에는

$$
\boxed{
\delta[n]=u[n]-u[n-1]
}
$$

관계가 있다.

---

## 9. 이산시간 주파수의 주기성

$$
e^{j(\omega+2\pi k)n}
=
e^{j\omega n}
$$

이므로

$$
\boxed{
\omega
\text{와}
\omega+2\pi k
\text{는 동일한 이산시간 주파수다}
}
$$

이 성질이 aliasing과 DTFT의 주기성으로 이어진다.

---

## 10. Part I 연습문제

### 문제 1

$$
x(t)=u(t)-u(t-2)
$$

의 모양을 구하라.

#### 풀이

$$
x(t)=
\begin{cases}
0,&t<0,\\
1,&0<t<2,\\
0,&t>2
\end{cases}
$$

이므로 폭 2의 직사각형 펄스다.

### 문제 2

$$
x(t)=e^t
$$

를 짝성분과 홀성분으로 나누어라.

#### 풀이

$$
x_e(t)=\frac{e^t+e^{-t}}{2}=\cosh t
$$

$$
x_o(t)=\frac{e^t-e^{-t}}{2}=\sinh t
$$

이다.

### 문제 3

$$
x(t)=e^{-at}u(t),
\qquad a>0
$$

의 에너지를 구하라.

#### 풀이

$$
E_x=
\int_0^\infty e^{-2at}\,dt
=
\frac{1}{2a}
$$

이다.

---

# Part II. 시스템

## 11. 시스템이란?

시스템은 입력신호를 출력신호로 바꾸는 규칙이다.

$$
\boxed{
y(t)=\mathcal{T}\{x(t)\}
}
$$

예:

$$
y(t)=2x(t)
$$

는 증폭기 모델,

$$
y(t)=x(t-1)
$$

은 지연 시스템이다.

---

## 12. 시스템의 핵심 성질

### 12.1 Memoryless

출력 $y(t_0)$가 같은 시각의 $x(t_0)$에만 의존하면 memoryless다.

$$
y(t)=x^2(t)
$$

는 memoryless이고,

$$
y(t)=x(t-1)
$$

은 memory가 있다.

### 12.2 Causality

현재 출력이 미래 입력에 의존하지 않으면 causal이다.

$$
y(t)=x(t-1)
$$

은 인과적이고,

$$
y(t)=x(t+1)
$$

은 비인과적이다.

### 12.3 Linearity

$$
\boxed{
\mathcal{T}\{a x_1+b x_2\}
=
a\mathcal{T}\{x_1\}
+
b\mathcal{T}\{x_2\}
}
$$

를 만족하면 선형이다.

예를 들어 $y=3x$는 선형이지만 $y=x^2$은 일반적으로 비선형이다.

### 12.4 Time invariance

입력을 $t_0$만큼 이동했을 때 출력도 같은 만큼 이동하면 시불변이다.

$$
y(t)=x(t-2)
$$

는 시불변이다.

$$
y(t)=t x(t)
$$

는 시스템 자체가 현재 시간 $t$를 사용하므로 시변이다.

### 12.5 BIBO stability

$$
\lvert x(t)\rvert\le M_x
$$

인 모든 bounded input에 대해

$$
\lvert y(t)\rvert\le M_y
$$

인 유한한 $M_y$가 존재하면 BIBO stable이다.

---

## 13. 왜 LTI 시스템이 중요한가?

LTI는 linear time-invariant다.

$$
\boxed{
\text{LTI}
=
\text{선형}
+
\text{시불변}
}
$$

LTI의 영초기상태 입력–출력 관계는 임펄스응답으로 표현할 수 있다. 미리 저장된 에너지가 있다면 전체 응답은 영입력응답과 영초기상태응답으로 나누며, 고정된 비영 초기조건을 포함한 입력–출력 사상이 선형이라고 단정할 수 없다.

---

## 14. 임펄스응답

LTI 시스템에 $\delta(t)$를 입력했을 때의 출력을

$$
\boxed{
h(t)
}
$$

라 한다.

시간불변성이 있으므로 $\delta(t-\tau)$를 입력하면 $h(t-\tau)$가 출력된다.

---

## 15. 합성곱의 유도

임의의 신호는

$$
\boxed{
x(t)
=
\int_{-\infty}^{\infty}
x(\tau)\delta(t-\tau)\,d\tau
}
$$

로 쓸 수 있다.

각 $\delta(t-\tau)$에 대한 출력이 $h(t-\tau)$이므로 선형성에 의해

$$
y(t)
=
\int_{-\infty}^{\infty}
x(\tau)h(t-\tau)\,d\tau
$$

이다.

따라서

$$
\boxed{
y(t)=x(t)\ast h(t)
}
$$

이다.

합성곱은

1. 뒤집기
2. 이동하기
3. 곱하기
4. 적분하기

로 시각화할 수 있다.

{% include signals-systems-visual.html kind="convolution" title="합성곱: 뒤집고 · 이동하고 · 곱하고 · 적분하기" %}

---

### 15.1 합성곱을 “과거의 입력이 남긴 흔적”으로 읽기

**쉽게 말하면:** 빈 방에서 박수를 한 번 치면 소리가 바로 사라지지 않고 잔향이 남는다. 여러 번 치면 각 박수의 잔향이 겹친다. 한 번의 박수에 대한 흔적이 $h$, 박수의 크기가 $x$, 지금 들리는 합이 $y$다. 이 비유는 소리의 크기에 비례하고 방의 특성이 시간에 따라 바뀌지 않는 LTI 근사에서 성립한다.

이산시간에서는 이 생각을 유한한 계산으로 확인할 수 있다. $x[0]=2$, $x[1]=1$, 나머지는 0이면

$$
x[n]=2\delta[n]+\delta[n-1].
$$

선형성으로 “두 배의 입력 → 두 배의 출력”, 시불변성으로 “한 칸 늦은 입력 → 한 칸 늦은 출력”이므로

$$
y[n]=2h[n]+h[n-1].
$$

예를 들어 $h[0]=1$, $h[1]=1/2$, 나머지가 0이면 $y[0]=2$, $y[1]=2$, $y[2]=1/2$이다. 임의의 수열은 $x[n]=\sum_k x[k]\delta[n-k]$로 쓸 수 있으므로 같은 논리를 모든 입력 시점에 적용하면 $y[n]=\sum_k x[k]h[n-k]$가 된다. 무한합은 수렴하고 시스템 연산과 합을 교환할 수 있는 조건에서 해석한다.

연속시간의 $x(\tau)d\tau$는 아주 짧은 구간의 입력 기여이고, 그것이 남긴 흔적이 $h(t-\tau)$다. $d\tau$를 빼면 넓이 대신 높이를 더하게 된다. **뒤집기는 임의로 추가한 규칙이 아니라, 현재 시각 $t$에서 과거 입력 시각 $\tau$를 뺀 “경과 시간” 때문에 생긴다.**

**직접 설명해 보기:** LTI 중 선형성이 없다면 왜 두 박수의 출력을 더할 수 없는가? 시불변성이 없다면 왜 모든 박수에 같은 $h$를 쓸 수 없는가?

---

## 16. 이산시간 합성곱

$$
\boxed{
y[n]
=
\sum_{k=-\infty}^{\infty}
x[k]h[n-k]
}
$$

이다.

연속시간의 적분이 이산시간에서는 합으로 바뀐다.

---

## 17. 합성곱의 성질

$$
x\ast h=h\ast x
$$

$$
(x\ast h_1)\ast h_2
=
x\ast(h_1\ast h_2)
$$

$$
x\ast(h_1+h_2)
=
x\ast h_1+x\ast h_2
$$

그리고

$$
\boxed{
x\ast\delta=x
}
$$

이다.

---

## 18. LTI 시스템의 인과성과 안정성

### 인과성

$$
\boxed{
h(t)=0
\qquad t<0
}
$$

이면 인과적이다.

### BIBO 안정성

$$
y(t)
=
\int x(\tau)h(t-\tau)\,d\tau
$$

이고 $\lvert x(\tau)\rvert\le M_x$라면

$$
\lvert y(t)\rvert
\le
M_x
\int_{-\infty}^{\infty}
\lvert h(\tau)\rvert\,d\tau
$$

이다.

따라서

$$
\boxed{
\int_{-\infty}^{\infty}
\lvert h(t)\rvert\,dt
<
\infty
}
$$

이면 BIBO stable이다.

---

## 19. 미분방정식과 LTI 시스템

RC 저역통과 회로:

$$
RC\frac{dy(t)}{dt}+y(t)=x(t)
$$

$R,C>0$이고 초기 커패시터 전압이 0일 때, 같은 시스템은 여러 관점으로 볼 수 있다.

### 미분방정식

$$
RC\,y'+y=x
$$

### 임펄스응답

$$
h(t)
=
\frac{1}{RC}
e^{-t/(RC)}u(t)
$$

### 합성곱

$$
y=x\ast h
$$

### Laplace

$$
H(s)=\frac{1}{1+sRC}
$$

### Fourier

$$
H(j\omega)=\frac{1}{1+j\omega RC}
$$

서로 다른 공식이 아니라 **같은 시스템을 다른 표현으로 보는 것**이다.

{% include signals-systems-visual.html kind="rc-step" title="RC 저역통과 필터: 단위계단 시간응답" %}



---

# Part III. 주파수영역

### 19.1 RC 응답을 직접 풀어 보기

**쉽게 말하면:** 커패시터 전압이 목표 전압에 가까워질수록 저항 양단의 전압차가 줄어 충전 속도도 느려진다. 그래서 일정한 속도의 직선 대신 처음에는 빠르고 나중에는 느린 지수곡선이 나온다.

저항 전류 $(x-y)/R$와 커패시터 전류 $C\,dy/dt$가 같으므로 $\tau=RC$라 놓으면 $\tau y'+y=x$다. 초기 전압이 0이고 $x(t)=u(t)$이면 $t>0$에서

$$
\frac{dy}{1-y}=\frac{dt}{\tau}
\quad\Longrightarrow\quad
-\ln(1-y)=\frac{t}{\tau}
\quad\Longrightarrow\quad
y(t)=1-e^{-t/\tau}.
$$

적분상수는 $y(0^+)=0$을 대입해 정했다. $t=\tau$에서 목표값의 $1-e^{-1}\approx0.632$에 도달한다.

단위계단 응답을 $s(t)=(1-e^{-t/\tau})u(t)$라 하자. LTI에서 $s=h*u$이고 $u'=\delta$이므로 분포 미분으로 $s'=h*\delta=h$다. $s$는 원점에서 점프하지 않으므로 미분에 추가 임펄스가 없고

$$
h(t)=\frac1\tau e^{-t/\tau}u(t).
$$

이것을 Fourier 변환하면

$$
H(j\omega)=\frac1\tau\int_0^\infty e^{-(1/\tau+j\omega)t}dt
=\frac1{1+j\omega\tau}.
$$

따라서 시간상수 $\tau$가 클수록 충전은 느리고, 주파수응답의 차단점 $\omega_c=1/\tau$는 낮아진다. **시간에서 빠르게 따라가지 못한다는 말과 높은 주파수를 줄인다는 말은 같은 회로의 두 설명**이다.

---

## 20. 왜 주파수영역을 배우는가?

구형파를 RC 회로에 넣는다고 하자.

시간영역에서는 미분방정식을 구간마다 풀어야 하지만, 구형파를

$$
\sin(\omega_0t),
\quad
\sin(3\omega_0t),
\quad
\sin(5\omega_0t),
\ldots
$$

의 합으로 분해하면 각 사인파에 대한 회로의 반응만 계산하면 된다.

즉

$$
\boxed{
\text{복잡한 파형}
\longrightarrow
\text{단순한 주파수 성분}
}
$$

이라는 관점이 주파수영역의 핵심이다.

---

### 20.1 왜 하필 사인파로 나누는가?

**쉽게 말하면:** 복잡한 색을 몇 가지 기본색의 양으로 기록하듯, 복잡한 파형도 기본 파형의 양으로 기록할 수 있다. 단, 모든 분해가 회로 계산에 똑같이 편리한 것은 아니다. 우리는 **회로를 통과해도 모양이 유지되는 기본 파형**을 고르고 싶다.

예를 들어 미분은 다항식 $t^2$를 $2t$로 바꾸지만, 복소지수는

$$
\frac{d}{dt}e^{j\omega t}=j\omega e^{j\omega t}
$$

처럼 모양을 유지한다. 미분방정식에 이 파형을 넣으면 미분이 $j\omega$의 곱셈으로 바뀐다. 또한 $e^{j\omega(t-\tau)}=e^{j\omega t}e^{-j\omega\tau}$이므로 지연도 상수배로 처리된다. 다음 절은 이 이유가 특정 회로만이 아니라 LTI 시스템 전체에 적용됨을 합성곱으로 증명한다.

복소수는 실제 전압이 허수라는 뜻이 아니다. $\cos\omega t=(e^{j\omega t}+e^{-j\omega t})/2$이므로 두 복소 회전의 합으로 실제 사인파를 표현하는 계산 도구다. 실수 신호와 실수 임펄스응답에서는 양·음 주파수 성분이 켤레쌍을 이루어 출력도 실수가 된다.

**언제 유리한가?** 정상상태 진동, 필터가 통과시키는 주파수, 여러 주파수의 혼합을 다룰 때다. 특정 시각의 스위칭과 초기조건이 핵심이면 시간영역이나 Laplace 해석이 먼저일 수 있다. 주파수영역이 모든 문제의 필수 출발점은 아니다.

---

## 21. 복소지수는 LTI 시스템의 고유함수

입력으로

$$
x(t)=e^{j\omega t}
$$

를 넣자.

합성곱으로 출력은

$$
y(t)
=
\int_{-\infty}^{\infty}
h(\tau)e^{j\omega(t-\tau)}\,d\tau
$$

이다.

$e^{j\omega t}$를 적분 밖으로 빼면

$$
y(t)
=
e^{j\omega t}
\int_{-\infty}^{\infty}
h(\tau)e^{-j\omega\tau}\,d\tau
$$

이다.

괄호 안 적분을 $H(j\omega)$라고 하면

$$
\boxed{
y(t)
=
H(j\omega)e^{j\omega t}
}
$$

이다.

즉 LTI 시스템은 복소지수의 주파수를 바꾸지 않고 크기와 위상만 바꾼다.

이 계산은 해당 주파수에서 적분이 존재하는 등 조건이 필요하다. $e^{j\omega t}$는 전 시간에 걸친 입력이다. $e^{j\omega t}u(t)$를 켜서 넣은 경우에는 과도응답이 더해질 수 있다.

이 성질 때문에 Fourier 해석이 LTI 시스템에 특히 잘 맞는다.

---

## 22. 푸리에 급수의 시스템 해석

주기 $T_0$, $\omega_0=2\pi/T_0$인 주기신호를

$$
x(t)
=
\sum_{k=-\infty}^{\infty}
c_k e^{jk\omega_0t}
$$

로 나타낼 수 있다.

계수는 $c_k=(1/T_0)\int_{t_0}^{t_0+T_0}x(t)e^{-jk\omega_0t}\,dt$로 구한다.

각 성분은 LTI 시스템에서

$$
e^{jk\omega_0t}
\longrightarrow
H(jk\omega_0)e^{jk\omega_0t}
$$

가 된다.

따라서 전체 출력은

$$
\boxed{
y(t)
=
\sum_{k=-\infty}^{\infty}
c_k H(jk\omega_0)e^{jk\omega_0t}
}
$$

이다.

이 식은 왜 저역통과 필터가 구형파의 모서리를 둥글게 만드는지 설명한다.

구형파의 날카로운 모서리는 높은 고조파가 필요하지만, 저역통과 필터는 높은 주파수일수록 더 크게 감쇠시키기 때문이다.

---

### 22.1 급수의 주파수가 왜 정수배인가?

**쉽게 말하면:** 주기 $T_0$인 파형은 한 바퀴 뒤에 출발점으로 돌아와야 한다. 재료로 쓰는 회전도 그 시간 동안 정수 바퀴 돌아야 서로 같은 주기로 이어 붙일 수 있다.

$e^{j\omega(t+T_0)}=e^{j\omega t}$를 요구하면 $e^{j\omega T_0}=1$이므로

$$
\omega T_0=2\pi k,\qquad \omega=k\omega_0,\quad k\in\mathbb Z.
$$

따라서 고조파 격자는 외워서 정한 주파수 목록이 아니라 **같은 주기로 반복되는 복소지수**에서 나온다.

### 22.2 계수 공식의 증명: 원하는 성분만 남기는 평균

두 함수의 “닮은 정도”를 한 주기에서 다음처럼 정의하자. 별표는 복소켤레다.

$$
\langle f,g\rangle=\frac1{T_0}\int_0^{T_0}f(t)g^*(t)\,dt.
$$

$\phi_k(t)=e^{jk\omega_0t}$라 하면

$$
\begin{aligned}
\langle\phi_k,\phi_m\rangle
&=\frac1{T_0}\int_0^{T_0}e^{j(k-m)\omega_0t}\,dt\\
&=\begin{cases}
1,&k=m,\\
\displaystyle\frac{e^{j(k-m)2\pi}-1}{j(k-m)\omega_0T_0}=0,&k\ne m.
\end{cases}
\end{aligned}
$$

이것이 **직교성**이다. 같은 속도로 도는 성분에 반대 회전을 곱하면 멈춰서 평균이 남고, 다른 속도는 한 주기 동안 상쇄된다. 이제 $x=\sum_k c_k\phi_k$의 양변에 $\phi_m^*$를 곱하고 평균을 내면

$$
\langle x,\phi_m\rangle=\sum_k c_k\langle\phi_k,\phi_m\rangle=c_m.
$$

그래서 계수 공식에 **음의 지수**와 **$1/T_0$**가 들어간다. 음의 지수는 찾는 성분의 회전을 상쇄하고, $1/T_0$는 적분을 평균으로 바꾸어 자기 자신과의 내적을 1로 만든다.

**직교성만으로 모든 신호를 복원할 수 있다는 증명까지 끝난 것은 아니다.** 한 주기에서 제곱적분 가능한 함수에 대해 복소지수계가 완비라는 별도 정리를 사용하면 부분합은 평균제곱 의미로 원 신호에 수렴한다. 구간별 매끄러운 신호는 연속점에서 원래 값, 점프점에서 좌우 극한의 평균으로 수렴한다. 여기서는 계수 공식을 직접 증명하고, 무한급수의 완비성과 수렴 정리는 이 조건 아래 사용한다.

### 22.3 가장 좋은 근사라는 뜻

유한 개의 고조파로 $$s_K(t)=\sum_{\vert k\vert \le K}a_k\phi_k(t)$$를 만들자. $\vert f \vert^2=\langle f,f\rangle$이고 $c_k=\langle x,\phi_k\rangle$이면, 직교성을 이용해 제곱을 전개하면

$$
\|x-s_K\|^2
=\|x\|^2-\sum_{|k|\le K}|c_k|^2
+\sum_{|k|\le K}|a_k-c_k|^2.
$$

앞의 두 항은 $a_k$에 무관하고 마지막 항은 음수가 될 수 없다. 따라서 $a_k=c_k$일 때 오차가 최소다. **푸리에 계수는 그 주파수들을 재료로 쓸 때 평균제곱 오차를 가장 작게 만드는 양**이다.

완비성으로 $K\to\infty$에서 오차가 0으로 가면 Parseval 관계도 나온다.

$$
\frac1{T_0}\int_0^{T_0}|x(t)|^2dt=\sum_{k=-\infty}^{\infty}|c_k|^2.
$$

왼쪽은 시간에서 잰 평균전력, 오른쪽은 직교한 주파수 성분의 전력 합이다. 서로 다른 성분의 교차항이 0이므로 가능하다.

### 22.4 손으로 계산하는 예: 구형파에 왜 홀수 고조파만 남는가?

$0<t<T_0/2$에서 1, $T_0/2<t<T_0$에서 $-1$인 주기 구형파를 생각하자. 양·음 면적이 같아 $c_0=0$이다. $k\ne0$에 대해서는

$$
\begin{aligned}
c_k&=\frac1{T_0}\left(\int_0^{T_0/2}e^{-jk\omega_0t}dt-\int_{T_0/2}^{T_0}e^{-jk\omega_0t}dt\right)\\
&=\frac{1-(-1)^k}{j\pi k}.
\end{aligned}
$$

짝수 $k$에서는 분자가 0, 홀수에서는 2다. 양·음 $k$를 짝지으면

$$
x(t)=\frac4\pi\left(\sin\omega_0t+\frac13\sin3\omega_0t+\frac15\sin5\omega_0t+\cdots\right)
$$

가 된다. 점프점에서는 위에서 설명한 평균값 0으로 수렴한다. 고조파를 늘리면 평평한 부분과 모서리가 더 잘 표현되지만, 점프 부근의 최대 오버슈트는 사라지지 않고 그 폭이 좁아지는 Gibbs 현상이 생긴다.

{% include signals-systems-visual.html kind="fourier-synthesis" title="직접 더해 보기: 홀수 고조파로 만드는 구형파" %}

**직접 설명해 보기:** “푸리에 급수는 파형을 사인파로 나눈다”에서 한 걸음 더 나아가, 왜 주파수가 정수배이고 왜 계수에 음의 지수와 한 주기 평균이 들어가는지 설명해 보자.

---

## 23. 연속시간 푸리에 변환

비주기신호에는 반복주기에서 정해지는 고조파 격자가 없으므로 연속적인 주파수로 분석한다. 절대적분 가능성은 보통 함수로서 Fourier 변환이 존재하는 충분조건이며, 더 넓게는 에너지 신호나 분포의 의미로 확장한다.

$$
\boxed{
X(\omega)
=
\int_{-\infty}^{\infty}
x(t)e^{-j\omega t}\,dt
}
$$

역변환은

$$
\boxed{
x(t)
=
\frac{1}{2\pi}
\int_{-\infty}^{\infty}
X(\omega)e^{j\omega t}\,d\omega
}
$$

이다.

### 왜 필요한가?

한 번만 발생하는 펄스, 과도현상, 통신 심볼처럼 주기적으로 반복되지 않는 신호도 주파수로 분석하기 위해서다.

---

### 급수에서 변환으로: 반복 간격을 무한히 벌리기

**쉽게 말하면:** 일정 간격으로 울리는 박수는 주기신호다. 박수 사이를 계속 벌리면, 가까이서 보는 사람에게는 한 번의 박수처럼 보인다. 이때 주파수 성분의 간격은 오히려 점점 좁아진다. 이 변화가 “급수의 합 → 변환의 적분”을 연결한다.

유한한 시간 구간에만 존재하는 적분 가능한 펄스 $x(t)$를, 펄스들이 겹치지 않는 주기 $T$로 반복한 $x_T(t)$를 만들자. $\Delta\omega=2\pi/T$이고 한 주기에 원 펄스 전체를 포함시키면

$$
\begin{aligned}
c_k^{(T)}&=\frac1T\int_{-\infty}^{\infty}x(t)e^{-jk\Delta\omega t}dt\\
&=\frac1T X(k\Delta\omega)
=\frac{\Delta\omega}{2\pi}X(k\Delta\omega).
\end{aligned}
$$

이를 급수의 합성식에 넣으면

$$
x_T(t)=\frac1{2\pi}\sum_{k=-\infty}^{\infty}X(k\Delta\omega)e^{jk\Delta\omega t}\,\Delta\omega.
$$

$T\to\infty$이면 $\Delta\omega\to0$이 되어, 적절한 수렴 조건 아래 오른쪽은 Riemann 합에서 적분으로 바뀐다.

$$
x(t)=\frac1{2\pi}\int_{-\infty}^{\infty}X(\omega)e^{j\omega t}d\omega.
$$

이것은 변환쌍과 정규화가 나오는 **극한 유도**다. 임의의 신호에 대한 역변환 정리 전체를 증명한 것은 아니다. 예를 들어 충분히 매끄럽고 빠르게 감소하는 함수에서는 정당화할 수 있고, 불연속점이나 에너지 신호는 각각의 수렴 의미를 구분한다.

**핵심 차이:** 급수의 $c_k$는 한 성분의 복소 진폭이고, 변환의 $X(\omega)$는 연속 주파수를 적분할 때 쓰는 가중치다. 실제로 $c_k^{(T)}=X(k\Delta\omega)\Delta\omega/(2\pi)$이므로 둘을 같은 높이로 비교하면 안 된다. $x$가 전압이면 $c_k$의 단위는 V, $X(\omega)$의 단위는 V·s이다.

### 한 번의 직사각형 펄스가 sinc가 되는 이유

$x(t)=1$ for $\vert t \vert<\tau/2$, 나머지는 0이라 하자. 정의에 직접 대입하면

$$
\begin{aligned}
X(\omega)&=\int_{-\tau/2}^{\tau/2}e^{-j\omega t}dt
=\frac{2\sin(\omega\tau/2)}{\omega}\\
&=\tau\,\operatorname{sinc}\!\left(\frac{\omega\tau}{2\pi}\right),
\qquad \operatorname{sinc}(u)=\frac{\sin(\pi u)}{\pi u}.
\end{aligned}
$$

$\omega=0$에서는 극한으로 $X(0)=\tau$이며 펄스의 면적과 같다. 첫 영점은 $\vert \omega \vert=2\pi/\tau$다. **짧은 펄스일수록 더 넓은 주파수 범위가 필요하다**는 말이 이 식에서 바로 나온다. 아래 CTFT 그래프는 $\tau=1$, Hz 주파수 $F$를 사용한 $X_a(F)=\operatorname{sinc}(F)$의 예다.

---

### 23.1 푸리에 해석의 지도: 연속·이산과 주기·비주기

여기까지의 푸리에 급수와 변환을 앞으로 배울 이산시간 해석과 함께 놓으면 네 가지 경우가 보인다. **시간축이 연속인가? 신호가 주기적인가?**를 먼저 묻자. 주파수축이 이산적이라는 말은 신호가 이산시간이라는 말과 다르다.

| 시간 신호 | 알맞은 표현 | 주파수 쪽의 독립변수 | 반복되는 구조 |
|---|---|---|---|
| 연속시간·주기 | CTFS: 연속시간 푸리에 급수 | 정수 고조파 $k$, 실제 주파수 $kF_0$ | 시간은 주기적, 계수열에 강제되는 주기는 없음 |
| 이산시간·주기 | DTFS: 이산시간 푸리에 급수 | 정수 $k$ | 시간 수열과 계수열 모두 $N$주기 |
| 연속시간·비주기 | CTFT: 연속시간 푸리에 변환 | 연속변수 $F$ 또는 $\Omega$ | 주파수에 강제되는 주기는 없음 |
| 이산시간·비주기 | DTFT: 이산시간 푸리에 변환 | 연속변수 $\omega$ | 주파수에서 항상 $2\pi$주기 |

표의 “연속 주파수”는 **모든 실수 주파수에서 표현을 정의한다**는 뜻이다. 변환값이 반드시 매끄러운 함수라는 뜻은 아니다. 주기신호의 Fourier 변환은 Dirac 임펄스를 포함하는 분포로도 표현할 수 있다. 아래 그림은 네 경우의 구조를 실제 변환쌍으로 비교한다.

{% include signals-systems-visual.html kind="fourier-map" title="시간영역 ↔ 주파수영역: 네 가지 푸리에 표현" %}

### 23.2 연속시간·주기: CTFS

주기 $T_p$, 기본주파수 $F_0=1/T_p$라 하자. 분석식은 한 주기에서 고조파별 계수를 추출하고, 합성식은 그 성분들을 다시 더한다.

$$
\begin{aligned}
c_k&=\frac{1}{T_p}\int_{t_0}^{t_0+T_p}x_a(t)e^{-j2\pi kF_0t}\,dt,\\
x_a(t)&=\sum_{k=-\infty}^{\infty}c_ke^{j2\pi kF_0t}.
\end{aligned}
$$

$k$는 정수이지만 $t$는 연속이다. 고조파 간격은 $F_0$이다. 예를 들어 $\cos(2\pi F_0t)$에는 $k=\pm1$ 성분이 각각 $1/2$씩 있다. 계수열은 일반적으로 비주기적이며 DTFS처럼 특정 주기로 반복해야 한다는 제약이 없다. 불연속점에서의 급수 수렴은 좌우 극한의 평균으로 해석하는 등 수렴 조건에 주의한다.

### 23.3 이산시간·주기: DTFS

$x[n+N]=x[n]$이면 분석·합성식은 다음과 같다.

$$
\begin{aligned}
c_k&=\frac{1}{N}\sum_{n=0}^{N-1}x[n]e^{-j2\pi kn/N},\\
x[n]&=\sum_{k=0}^{N-1}c_ke^{j2\pi kn/N}.
\end{aligned}
$$

$e^{j2\pi(k+N)n/N}=e^{j2\pi kn/N}$이므로 서로 다른 기저는 $N$개뿐이고 $c_{k+N}=c_k$이다. **시간도 이산·주기, 계수도 이산·주기**라는 것이 위 비교표의 이산시간·주기 경우다.

### 23.4 연속시간·비주기: CTFT

비교도처럼 주파수를 Hz 단위의 $F$로 쓰면

$$
\begin{aligned}
X_a(F)&=\int_{-\infty}^{\infty}x_a(t)e^{-j2\pi Ft}\,dt,\\
x_a(t)&=\int_{-\infty}^{\infty}X_a(F)e^{j2\pi Ft}\,dF.
\end{aligned}
$$

앞의 rad/s 표현과는 $\Omega=2\pi F$로 연결된다. $d\Omega=2\pi\,dF$이므로 **Hz 역변환에는 $1/(2\pi)$가 없고 rad/s 역변환에는 있다.** 두 규약의 정규화 상수를 섞지 않는다.

### 23.5 이산시간·비주기: DTFT

$$
\begin{aligned}
X(e^{j\omega})&=\sum_{n=-\infty}^{\infty}x[n]e^{-j\omega n},\\
x[n]&=\frac{1}{2\pi}\int_{-\pi}^{\pi}X(e^{j\omega})e^{j\omega n}\,d\omega.
\end{aligned}
$$

$\omega$는 rad/sample 단위의 **연속 주파수**다. $X(e^{j(\omega+2\pi)})=X(e^{j\omega})$이므로 역변환은 어느 길이 $2\pi$ 구간에서 적분해도 된다. 이산시간이라고 해서 주파수도 자동으로 이산인 것은 아니다. 절대합 가능한 수열은 이 식이 잘 정의되는 대표적인 경우다.

### 23.6 두 규칙과 DFT로의 연결

- **시간에서 주기적 → 주파수에서 이산 고조파로 표현한다.**
- **시간에서 이산적 → 주파수 표현이 주기적이다.**

DTFS와 DFT는 같은 지수 기저를 사용하지만 여기서의 정규화는 다르다. 길이 $N$ 블록을 주기적으로 연장한 수열의 DTFS 계수가 $c_k$이면, 뒤에서 정의할 DFT는 $X[k]=Nc_k$이다. 유한 블록의 DFT를 쓴다고 **관측 이전의 실제 신호가 주기적이었다고 가정할 필요는 없다.** 블록의 주기적 연장은 DFT를 해석하는 한 방법이고, 다른 방법은 블록 밖을 0으로 둔 수열의 DTFT를 $N$개 주파수에서 읽는 것이다.

---

### 23.7 무엇을 써야 할까? 데이터와 질문으로 고르기

변환의 선택은 정리의 참·거짓처럼 증명할 대상이라기보다 **문제의 구조에 맞는 표현을 고르는 판단**이다. 그 판단을 뒷받침하는 수학적 이유는 앞에서 유도한 고조파 격자, 주기성, 앞으로 증명할 유한 기저에 있다.

| 실제 질문 | 첫 선택 | 그렇게 고르는 이유 |
|---|---|---|
| 반복되는 아날로그 구형파가 필터를 통과하면? | CTFS | 한 주기의 계수 $c_k$만 구해 각 고조파에 $H(jk\omega_0)$를 곱하면 된다. |
| 한 번의 아날로그 펄스에는 어떤 주파수가 있는가? | CTFT | 반복주기가 없으므로 특정 고조파 격자에 묶지 않고 연속 주파수를 분석한다. |
| $N$샘플 패턴이 무한히 반복되는 수열은? | DTFS | 서로 다른 복소지수 기저가 $N$개이고 계수도 $N$주기다. |
| 이론적인 디지털 필터의 모든 주파수에서의 응답은? | DTFT | 수열 $h[n]$의 주파수응답을 연속변수 $\omega$로 표현한다. |
| 녹음한 $N$개 샘플의 스펙트럼을 컴퓨터로 계산하려면? | DFT, 계산은 FFT | 유한한 벡터를 유한한 좌표로 변환한다. FFT는 DFT를 빠르게 구하는 알고리즘이다. |
| 초기 전압이 있는 회로의 과도응답이나 안정성은? | 미분방정식·Laplace | 초기조건과 지수적 성장·감쇠를 직접 다루기 좋다. |
| 차분방정식과 디지털 시스템의 극점·수렴은? | Z 변환 | 복소평면과 ROC로 수열의 성장·감쇠 및 안정성을 함께 본다. |

주기신호도 분포의 의미로 CTFT를 쓸 수 있다. 이 경우

$$
x(t)=\sum_k c_ke^{jk\omega_0t}
\quad\longleftrightarrow\quad
X(\omega)=2\pi\sum_k c_k\delta(\omega-k\omega_0).
$$

급수는 이 임펄스들의 **위치가 이미 정해져 있을 때 계수만 간결하게 기록하는 방식**이다. “주기신호에 변환을 쓰면 틀린다”는 뜻은 아니다.

**예를 들어 1초 녹음한 피아노 소리:** 저장된 숫자에서 DFT를 계산한다. 그 결과는 잘라낸 유한 수열의 DTFT를 일정 간격으로 읽은 것이다. 원래 피아노 소리가 1초마다 반복된다는 증거가 아니다. 실제로 반복되는 파형의 고조파를 이론적으로 구하는 문제라면 푸리에 급수를 쓴다.

**직접 설명해 보기:** 같은 피아노 소리라도 “연속적인 물리 신호의 스펙트럼”과 “저장한 숫자들의 계산”에 왜 서로 다른 표현이 자연스러운가?

---

### 23.8 상황별 연습: 먼저 도구를 고르고, 끝까지 계산하기

각 문제는 위 선택표의 한 행에 대응한다. 풀이를 읽기 전에 **시간이 연속인지 이산인지 → 실제로 주기적인지 → 무엇을 구하려는지**를 먼저 말해 보자. 공식 이름을 맞히는 것보다 그 선택으로 계산이 어떻게 쉬워지는지 이해하는 것이 목표다.

#### 문제 A · CTFS: 반복 구형파를 RC 필터에 넣으면?

**문제.** 주기 $T_0=1\,\mathrm{s}$이고 한 주기에서 $0<t<1/2$이면 1 V, $1/2<t<1$이면 $-1$ V인 구형파를 RC 저역통과 필터에 넣는다. $\tau=RC=1/(2\pi)\,\mathrm{s}$이고 정상상태 출력만 구한다.

1. 어떤 푸리에 표현이 적합한가?
2. 입력의 복소 급수 계수 $c_k$를 구하라.
3. 출력의 기본파와 3차 고조파의 진폭을 구하고 모서리가 둥글어지는 이유를 설명하라.

**쉬운 출발점.** 반복되는 멜로디를 음별로 나눈 뒤, 필터가 각 음의 크기와 위상을 얼마나 바꾸는지 계산한다고 생각하자. 여기서는 한 주기를 계속 반복하므로 CTFS가 자연스럽다. 스위치를 켠 직후의 과도응답은 이 문제의 대상이 아니다.

**해설 1 — 한 주기에서 성분을 추출한다.** $\omega_0=2\pi\,\mathrm{rad/s}$이며 양·음 면적이 같아 $c_0=0$이다. $k\ne0$이면

$$
\begin{aligned}
c_k&=\int_0^{1/2}e^{-j2\pi kt}dt-\int_{1/2}^{1}e^{-j2\pi kt}dt\\
&=\frac{1-(-1)^k}{j\pi k}.
\end{aligned}
$$

짝수 고조파는 0이고, 양·음의 홀수 고조파를 짝지으면 입력은 $\sum_{k=1,3,5,\ldots}(4/(\pi k))\sin(2\pi kt)$가 된다.

**해설 2 — 각 고조파에 필터 응답을 곱한다.**

$$
H(jk\omega_0)=\frac1{1+jk\omega_0\tau}=\frac1{1+jk},\qquad
\vert H \vert =\frac1{\sqrt{1+k^2}},\quad \arg H=-\arctan k.
$$

따라서 정상상태 출력은

$$
y_{\mathrm{ss}}(t)=\sum_{k=1,3,5,\ldots}
\frac4{\pi k\sqrt{1+k^2}}
\sin(2\pi kt-\arctan k).
$$

기본파 진폭은 $4/(\pi\sqrt2)\approx0.900$ V, 3차 고조파는 $4/(3\pi\sqrt{10})\approx0.134$ V다. 입력의 고조파 진폭은 $1/k$에 비례하지만 출력에서는 큰 $k$에 대해 대략 $1/k^2$로 작아진다. 모서리를 표현하는 높은 고조파가 더 약해져 파형이 부드러워진다.

**이해 확인.** 왜 $H(j\omega_0)$ 하나를 구형파 전체에 곱하면 안 될까? 구형파에는 서로 다른 고조파가 들어 있고, 필터가 각각에 다른 이득과 위상을 적용하기 때문이다.

#### 문제 B · CTFT: 한 번 발생하는 펄스의 폭과 대역폭

**문제.** $\vert t \vert <1\,\mathrm{s}$에서 1 V, 그 밖에서는 0인 펄스가 한 번 발생한다. Hz 규약으로 변환 $X(F)$를 구하고, $X(0)$과 첫 양의 영점을 구하라. 펄스 폭을 절반으로 줄이면 영점은 어디로 이동하는가?

**쉬운 출발점.** 짧게 반짝이는 신호를 만들려면 여러 속도의 진동을 함께 써야 한다. 한 번의 펄스에는 반복주기가 없으므로 CTFT로 연속 주파수를 살펴본다.

**해설 — 정의에 펄스가 있는 구간만 넣는다.**

$$
\begin{aligned}
X(F)&=\int_{-1}^{1}e^{-j2\pi Ft}dt
=\frac{\sin(2\pi F)}{\pi F}
=2\operatorname{sinc}(2F),\\
\operatorname{sinc}(u)&=\frac{\sin(\pi u)}{\pi u}.
\end{aligned}
$$

$F=0$에서는 극한으로 $X(0)=2$ V·s이며 펄스의 면적과 같다. 첫 양의 영점은 $F=1/2$ Hz다. 폭을 1초로 줄여 $\vert t \vert <1/2$에서만 1로 만들면 $X(F)=\operatorname{sinc}(F)$가 되어 첫 영점은 1 Hz로 이동한다.

**이해 확인.** 여기서 “대역이 넓어진다”는 것은 주엽의 폭이 넓어진다는 뜻이다. 직사각형 펄스의 sinc에는 무한히 이어지는 꼬리가 있어 엄밀하게 유한 대역폭인 신호는 아니다. 또 Hz 규약의 역변환에는 $1/(2\pi)$를 붙이지 않는다.

#### 문제 C · DTFS: 네 샘플마다 한 번 나타나는 수열

**문제.** $x[n]=1$ when $n$이 4의 배수이고, 그 밖에는 0이다. DTFS 계수 네 개를 구하고 합성식으로 $n=0,1$의 값을 확인하라.

**쉬운 출발점.** “1, 0, 0, 0”이라는 네 칸 패턴이 끝없이 반복된다. 시간은 정수 칸이고 실제 신호가 주기적이므로 DTFS를 쓴다.

**해설 1 — 한 주기의 네 숫자로 계수를 구한다.**

$$
c_k=\frac14\sum_{n=0}^{3}x[n]e^{-j2\pi kn/4}=\frac14,
\qquad k=0,1,2,3.
$$

$n=0$인 항만 남으므로 모든 계수가 $1/4$이다. 계수열을 전체 정수로 연장하면 $c_{k+4}=c_k$다. 이 예의 계수열은 상수이므로 4보다 작은 주기도 가지며, 4는 반드시 기본주기라는 뜻은 아니다.

**해설 2 — 다시 더해 원 샘플을 확인한다.**

$$
x[0]=\frac14(1+1+1+1)=1,
\qquad
x[1]=\frac14(1+j-1-j)=0.
$$

회전들이 $n=0$에서는 같은 방향으로 더해지고, $n=1$에서는 서로 상쇄된다. 같은 방식으로 $n=2,3$에서도 0이고 이후 반복된다.

**이해 확인.** 이 네 숫자의 DFT도 $1/4$일까? 아니다. 이 글의 DFT 규약은 정변환에 $1/N$이 없으므로 $X[k]=4c_k=1$이다. 같은 기저를 쓰지만 정규화 위치가 다르다.

#### 문제 D · DTFT: 두 샘플 평균 필터는 어떤 주파수를 남길까?

**문제.** $y[n]=(x[n]+x[n-1])/2$인 필터의 주파수응답을 구하고, $\omega=0,\pi/2,\pi$에서의 크기를 계산하라.

**쉬운 출발점.** 이웃한 두 값이 비슷하면 평균도 비슷한 값이다. 두 값이 정반대이면 평균은 0이다. 모든 입력 주파수에서 이 현상을 알아보려면 임펄스응답의 DTFT를 구한다.

**해설 — 두 탭의 지연을 복소 회전으로 쓴다.**

$$
h[n]=\frac12\delta[n]+\frac12\delta[n-1]
\quad\Longrightarrow\quad
H(e^{j\omega})=\frac12(1+e^{-j\omega})
=e^{-j\omega/2}\cos(\omega/2).
$$

따라서 크기는 $\vert \cos(\omega/2)\vert $이다. DC에서는 1, $\pi/2$에서는 $1/\sqrt2\approx0.707$, $\pi$에서는 0이다. $\omega=\pi$의 입력 $x[n]=(-1)^n$을 원래 차분식에 넣어도 두 값이 상쇄되어 출력이 0인 것을 확인할 수 있다. 응답이 0인 지점의 위상은 정의되지 않는다.

**이해 확인.** 필터 계수가 두 개라고 해서 주파수도 두 개뿐일까? 아니다. DTFT의 $\omega$는 연속변수다. 2점 DFT로는 이 응답의 두 주파수 값만 읽는다.

#### 문제 E · DFT와 FFT: 녹음한 여덟 숫자에서 주파수 찾기

**문제.** $f_s=8$ Hz로 얻은 $N=8$개 샘플이 $x[n]=\cos(\pi n/2)$, $0\le n<8$이다. DFT의 0이 아닌 bin, 그 값, 실제 주파수를 구하라. FFT를 쓰면 답이 바뀌는가?

**쉬운 출발점.** 컴퓨터가 가진 것은 여덟 숫자다. 이 벡터를 여덟 주파수 좌표로 바꾸는 DFT를 계산하고, FFT로 그 계산을 빠르게 할 수 있다.

**해설 1 — 코사인을 두 복소지수로 나눈다.**

$$
x[n]=\frac12e^{j2\pi(2)n/8}+\frac12e^{-j2\pi(2)n/8}.
$$

DFT 기저와 같은 주파수끼리 곱해 합하면 8, 다른 주파수이면 0이 되는 직교성을 적용한다. 따라서

$$
X[2]=4,\qquad X[6]=4,
\qquad\text{나머지 }X[k]=0.
$$

정규화하면 $\vert X[2]\vert /N=\vert X[6]\vert /N=1/2$이다. 실수 코사인의 진폭 1이 양·음 주파수 성분으로 반씩 나뉜 것이다.

**해설 2 — bin을 Hz로 읽는다.** 간격은 $\Delta f=f_s/N=1$ Hz다. $k=2$는 $+2$ Hz이고 $k=6$은 음의 주파수로 읽으면 $(6-8)\Delta f=-2$ Hz다. 이산시간에서 6 Hz와 $-2$ Hz는 같은 샘플 회전을 나타낸다.

FFT도 동일한 DFT 값을 구한다. 반올림 오차를 제외하면 결과는 같고 계산 순서와 연산량만 달라진다.

**이해 확인.** 뒤에 0을 채워 32점 FFT를 하면 새 주파수를 구별하는 정보가 생길까? 간격은 $8/32=0.25$ Hz로 촘촘해지지만, 관측 데이터는 그대로다. 원래 8개 샘플의 DTFT를 더 촘촘히 읽는 것이며 관측 시간이 늘어난 것은 아니다.

#### 문제 F · Laplace: 초기 전압이 있는 RC 회로

**문제.** $\tau=RC=1$ s인 회로가 $y'+y=u(t)$를 만족한다. 초기 커패시터 전압은 $y(0^-)=2$ V다. $t\ge0$의 출력을 구하고, 왜 $Y=HX$만으로는 부족한지 설명하라.

**쉬운 출발점.** 물통에 이미 물이 들어 있다면 이후 수도꼭지에서 들어오는 물만 계산해서는 전체 물의 양을 알 수 없다. 회로에서도 입력에 의한 응답과 처음 저장된 에너지의 응답을 함께 구해야 한다.

**해설 1 — 초기조건을 포함하는 단방향 Laplace를 쓴다.**

$$
sY(s)-2+Y(s)=\frac1s
\quad\Longrightarrow\quad
Y(s)=\frac1{s(s+1)}+\frac2{s+1}.
$$

첫 항은 초기조건이 0일 때의 입력 응답, 둘째 항은 초기 전압에 의한 응답이다. 부분분수로 정리하면

$$
Y(s)=\frac1s+\frac1{s+1}
\quad\Longrightarrow\quad
y(t)=1+e^{-t},\qquad t\ge0.
$$

**해설 2 — 원 문제에 대입해 확인한다.** $y(0^+)=2$이고 $y'+y=-e^{-t}+1+e^{-t}=1$이다. 시간이 지나면 1 V로 수렴한다. 전달함수는 $H(s)=1/(s+1)$이지만 $H(s)X(s)$만 계산하면 $1-e^{-t}$가 나와 초기 전압 2 V를 놓친다.

**이해 확인.** 지수항이 줄어드는 이유는 무엇일까? 자연응답의 극점이 $s=-1$이라 $e^{-t}$로 감쇠하기 때문이다. 외부 입력이 계속 있으므로 전체 출력이 0으로 가는 것은 아니다.

#### 문제 G · Z 변환: 피드백 필터의 극점과 안정성

**문제.** 초기 정지 상태의 인과적 시스템이 $y[n]=\frac12y[n-1]+x[n]$을 만족한다. 전달함수, 임펄스응답, ROC를 구하고 BIBO 안정성을 판단하라. 피드백 계수를 $1.2$로 바꾸면 어떻게 되는가?

**쉬운 출발점.** 한 번 들어온 값의 절반이 다음 시각에 남고, 다시 그 절반이 그다음에 남는다. 흔적이 줄어드는지 커지는지가 중요하므로 Z 변환과 ROC가 적합하다.

**해설 1 — 지연을 $z^{-1}$로 바꾼다.** 초기 정지 조건에서

$$
Y(z)=\frac12z^{-1}Y(z)+X(z)
\quad\Longrightarrow\quad
H(z)=\frac1{1-\frac12z^{-1}}.
$$

인과성을 이용해 양의 시간 방향으로 등비급수를 전개하면

$$
H(z)=\sum_{n=0}^{\infty}\left(\frac12\right)^nz^{-n},
\qquad h[n]=\left(\frac12\right)^nu[n],\qquad |z|>\frac12.
$$

극점은 $z=1/2$이고 ROC가 단위원을 포함한다. 직접 절대합을 구해도

$$
\sum_{n=-\infty}^{\infty}|h[n]|=\sum_{n=0}^{\infty}\left(\frac12\right)^n=2<\infty
$$

이므로 BIBO 안정적이다. 크기가 $M$ 이하인 입력의 출력은 크기 $2M$ 이하로 제한된다.

**해설 2 — 계수를 $1.2$로 바꾼다.** 인과적 임펄스응답은 $1.2^nu[n]$, ROC는 $\vert z \vert >1.2$다. 흔적이 성장하고 절대합이 발산하며 단위원도 ROC 밖이다. 크기가 1 이하인 단위샘플 입력만 넣어도 출력이 끝없이 커지므로 BIBO 불안정임을 바로 확인할 수 있다.

**이해 확인.** 유리식에 $z=e^{j\omega}$를 넣어 유한한 값이 나와도 DTFT가 존재한다고 할 수 있을까? 아니다. 인과적 $1.2^nu[n]$의 DTFT 급수는 수렴하지 않는다. 대입한 대수식만 볼 것이 아니라 단위원이 ROC 안에 있는지 확인해야 한다.

---

## 24. 푸리에 변환의 핵심 성질

### 24.1 선형성

$$
a x_1(t)+b x_2(t)
\longleftrightarrow
aX_1(\omega)+bX_2(\omega)
$$

### 24.2 시간 이동

$$
\boxed{
x(t-t_0)
\longleftrightarrow
e^{-j\omega t_0}X(\omega)
}
$$

시간 이동은 magnitude를 바꾸지 않고 phase만 바꾼다.

### 24.3 주파수 이동

$$
\boxed{
e^{j\omega_ct}x(t)
\longleftrightarrow
X(\omega-\omega_c)
}
$$

이 성질이 변조의 핵심이다.

### 24.4 미분

$$
\boxed{
\frac{dx(t)}{dt}
\longleftrightarrow
j\omega X(\omega)
}
$$

미분이 주파수영역에서는 단순 곱셈으로 바뀐다.

### 24.5 합성곱

$$
\boxed{
x(t)\ast h(t)
\longleftrightarrow
X(\omega)H(\omega)
}
$$

시간영역에서 복잡한 합성곱이 주파수영역에서는 곱셈이 된다.

---

### 24.6 성질을 외우기 전에 정의에서 다시 만들기

아래는 절대적분 가능성과 필요한 미분·경계 조건을 만족하여 변수 치환과 적분 순서 교환이 가능한 경우의 유도다.

**시간 이동:** $u=t-t_0$로 치환하면

$$
\int x(t-t_0)e^{-j\omega t}dt
=\int x(u)e^{-j\omega(u+t_0)}du
=e^{-j\omega t_0}X(\omega).
$$

지연은 파형의 재료를 바꾸지 않고 시작 시각을 바꾼다. 그래서 크기는 같고 위상만 바뀐다.

**주파수 이동:** 두 지수를 합치면 끝난다.

$$
\int x(t)e^{j\omega_ct}e^{-j\omega t}dt
=\int x(t)e^{-j(\omega-\omega_c)t}dt=X(\omega-\omega_c).
$$

**미분:** 부분적분하고 $x(t)e^{-j\omega t}\to0$인 경계 조건을 사용하면

$$
\int x'(t)e^{-j\omega t}dt
=\left[x(t)e^{-j\omega t}\right]_{-\infty}^{\infty}
+j\omega\int x(t)e^{-j\omega t}dt=j\omega X(\omega).
$$

경계항을 아무 이유 없이 버리는 것이 아니다. 점프가 있는 신호의 미분은 임펄스를 포함하는 분포로 해석해야 한다.

**합성곱:** $u=t-\tau$로 놓고 적분 순서를 바꾸면

$$
\begin{aligned}
Y(\omega)&=\int\!\int x(\tau)h(t-\tau)e^{-j\omega t}\,d\tau\,dt\\
&=\int x(\tau)e^{-j\omega\tau}d\tau\int h(u)e^{-j\omega u}du\\
&=X(\omega)H(\omega).
\end{aligned}
$$

이것이 주파수 해석을 쓰는 계산상의 보상이다. 시간에서 모든 과거의 흔적을 겹쳐 더하던 작업이 주파수마다 한 번의 곱셈으로 바뀐다.

---

## 25. 주파수응답

LTI 시스템에서

$$
Y(j\omega)=H(j\omega)X(j\omega)
$$

이므로

$$
\boxed{
H(j\omega)
=
\frac{Y(j\omega)}{X(j\omega)}
}
$$

이다. 이 비율은 $X(j\omega)\ne0$인 주파수에서만 쓸 수 있다. 주파수응답 자체는 입력과 무관하게 임펄스응답의 Fourier 변환으로 정의한다.

$H(j\omega)$는 복소수이므로

$$
H(j\omega)
=
\lvert H(j\omega)\rvert
e^{j\phi(\omega)}
$$

로 쓸 수 있다.

- $\lvert H(j\omega)\rvert$: 진폭 변화
- $\phi(\omega)$: 위상 변화

---

{% include signals-systems-visual.html kind="rc-frequency" title="RC 저역통과 필터: 주파수별 크기응답" %}

## 26. 필터

### 26.1 Low-pass filter

낮은 주파수를 통과시키고 높은 주파수를 줄인다.

### 26.2 High-pass filter

낮은 주파수를 줄이고 높은 주파수를 통과시킨다.

### 26.3 Band-pass filter

특정 대역만 통과시킨다.

### 26.4 Band-stop filter

특정 대역만 제거한다.

실제 필터는 이상적인 벽처럼 갑자기 0이 되지 않고 transition band를 가진다.

---

## 27. Bode plot

진폭응답을 dB로 나타내면

$$
\boxed{
20\log_{10}
\lvert H(j\omega)\rvert
}
$$

이다.

### 왜 로그를 사용하는가?

1. 곱셈이 덧셈으로 바뀐다.
2. 매우 넓은 크기 범위를 압축해서 볼 수 있다.
3. 극점과 영점의 효과를 직선 근사로 해석하기 쉽다.

---

## 28. Laplace 변환과 전달함수

영초기조건에서

$$
\boxed{
H(s)
=
\frac{Y(s)}{X(s)}
}
$$

를 전달함수라고 한다.

RC 저역통과 필터는

$$
H(s)=\frac{1}{1+sRC}
$$

이다.

수렴영역이 허수축을 포함하면

$$
s=j\omega
$$

를 대입하여 Fourier 주파수응답을 얻을 수 있다.

즉 Laplace와 Fourier는 별개의 과목이 아니라 서로 연결된 표현이다.

---

### 28.1 Fourier가 있는데 왜 Laplace가 더 필요한가?

**쉽게 말하면:** 계속 커지는 신호를 그대로 모두 더하면 무한대가 된다. 먼저 시간에 따라 약해지는 가중치를 씌운 뒤 더하면 수렴할 수 있다. 그 가중치의 강도를 새로운 좌표로 삼은 것이 Laplace 변환이다.

$s=\sigma+j\omega$라 하면 양방향 변환은

$$
X(s)=\int_{-\infty}^{\infty}x(t)e^{-\sigma t}e^{-j\omega t}dt.
$$

즉 $x(t)e^{-\sigma t}$의 Fourier 변환이다. 예를 들어 $x(t)=e^{at}u(t)$, $a\in\mathbb R$이면

$$
X(s)=\int_0^\infty e^{-(s-a)t}dt=\frac1{s-a},\qquad \operatorname{Re}s>a.
$$

$a>0$일 때 원 신호는 성장하여 보통의 Fourier 적분이 수렴하지 않지만 Laplace는 $\sigma>a$에서 존재한다. $s=j\omega$를 대입해 Fourier 변환을 얻으려면 **허수축이 ROC에 포함되어야 한다.** 식의 모양만 보고 무조건 대입할 수 없다.

초기조건은 별도로 구분한다. 단방향 Laplace에서는 $\mathcal L_u\{y'\}=sY(s)-y(0^-)$이므로 $\tau y'+y=x$가

$$
Y(s)=\frac{X(s)}{\tau s+1}+\frac{\tau y(0^-)}{\tau s+1}
$$

로 바뀐다. 첫 항은 입력에 의한 응답, 둘째는 초기 저장 에너지에 의한 응답이다. 전달함수 $H=1/(\tau s+1)$는 초기조건이 0인 입력·출력 관계를 나타낸다.

---

## 29. Pole과 Zero

전달함수를

$$
H(s)
=
K
\frac{\prod_i(s-z_i)}
{\prod_\ell(s-p_\ell)}
$$

로 쓰자.

- $z_i$: zero
- $p_\ell$: pole

pole은 자연응답과 안정성에 깊이 연결된다.

예를 들어

$$
H(s)=\frac{1}{s+a}
$$

이면 pole은

$$
s=-a
$$

이다.

$H(s)$를 인과적으로 해석하면 ROC는 $\operatorname{Re}s>-a$이고, $a>0$이면 시간응답에

$$
e^{-at}
$$

가 나타나 감쇠한다.

{% include signals-systems-visual.html kind="polezero" title="극점 위치와 감쇠 · 성장" %}

---

# Part IV. 연속시간에서 디지털로

## 30. ADC 앞뒤에서 무슨 일이 일어나는가?

실제 디지털 시스템은 보통 다음 흐름을 가진다.

$$
\boxed{
\text{Analog}
\rightarrow
\text{AA Filter}
\rightarrow
\text{Sampling}
\rightarrow
\text{Quantization}
\rightarrow
\text{Digital Data}
}
$$

샘플링과 양자화를 구분해야 한다.

- 샘플링: 시간축 이산화
- 양자화: 진폭축 이산화

---

## 31. Sampling

샘플주기 $T_s$마다 값을 읽으면

$$
\boxed{
x[n]=x(nT_s)
}
$$

이고

$$
\boxed{
f_s=\frac{1}{T_s}
}
$$

이다.

---

## 32. Sampling theorem

원 신호가

$$
\lvert f\rvert\le B
$$

에 대역제한되어 있다고 하자.

이상적인 임펄스 샘플링을 하면 원 스펙트럼이 $f_s$ 간격으로 반복된다.

복제된 스펙트럼이 겹치지 않으려면

$$
\boxed{
f_s>2B
}
$$

여야 한다.

이것이 Nyquist sampling condition이다.

실제 회로에서는 이상적인 brick-wall filter가 없으므로 보통 여유를 둔다.

{% include signals-systems-visual.html kind="sampling" title="샘플링 주파수와 aliasing" %}

---

### 32.1 샘플링 정리가 나오는 이유: 스펙트럼의 복제

**쉽게 말하면:** 샘플링은 주파수 그림을 일정한 간격으로 복사해 놓는다. 복사본이 겹치지 않으면 원본만 골라낼 수 있지만, 겹치면 어느 원본에서 온 값인지 일반적으로 구별할 수 없다.

이를 Hz 규약으로 확인하자. 간격 $T_s$의 임펄스열 $p(t)=\sum_n\delta(t-nT_s)$는 한 주기 면적이 1이므로 모든 푸리에 급수 계수가 $1/T_s$다. 따라서 분포의 의미에서

$$
P(F)=\frac1{T_s}\sum_k\delta(F-kf_s),\qquad f_s=1/T_s.
$$

샘플 신호를 $x_s(t)=x(t)p(t)$로 표현하면 시간의 곱은 주파수의 합성곱이므로

$$
X_s(F)=\frac1{T_s}\sum_kX(F-kf_s).
$$

$X(F)=0$ for $\vert F \vert>B$이면 각 복사본의 폭은 $2B$이고 중심 간격은 $f_s$다. 그래서 $f_s>2B$이면 겹치지 않는다. 이때 통과대역 이득 $T_s$, 경계 $f_s/2$인 이상적 저역통과 필터로 가운데 복사본을 추출하면 원 스펙트럼이 복원된다.

반대로 왜 구별할 수 없는지 샘플 자체로도 확인할 수 있다.

$$
e^{j2\pi(f+kf_s)nT_s}=e^{j2\pi fnT_s}e^{j2\pi kn}=e^{j2\pi fnT_s}.
$$

$f$와 $f+kf_s$가 **완전히 같은 숫자열**을 만든다. 이는 단순히 그래프가 거칠어지는 문제가 아니라 정보의 모호성이다. 등호 $f_s=2B$에서는 경계 주파수와 위상에 주의해야 한다. 예를 들어 $\sin(2\pi Bt)$를 $f_s=2B$로 샘플링하면 모두 0이다. 실제 장비에는 필터 전이대역도 있어 여유를 둔다.

---

## 33. Aliasing

$f_s=1000\,\mathrm{Hz}$일 때 900 Hz 사인파를 샘플링하자.

$$
x[n]
=
\cos\left(
2\pi\frac{900}{1000}n
\right)
$$

이다.

그런데

$$
2\pi\frac{900}{1000}n
=
2\pi n
-
2\pi\frac{100}{1000}n
$$

이고 cosine의 주기성 때문에

$$
\boxed{
\cos\left(
2\pi\frac{900}{1000}n
\right)
=
\cos\left(
2\pi\frac{100}{1000}n
\right)
}
$$

이다.

즉 샘플만 보면 900 Hz와 100 Hz를 구분할 수 없다.

그래서 ADC 앞에 anti-aliasing filter가 필요하다.

---

## 34. Reconstruction

이상적으로 대역제한된 신호는

$$
\boxed{
x(t)
=
\sum_{n=-\infty}^{\infty}
x[n]
\operatorname{sinc}
\left(
\frac{t-nT_s}{T_s}
\right)
}
$$

로 복원할 수 있다.

여기서는 정규화된 $\operatorname{sinc}(u)=\sin(\pi u)/(\pi u)$, $\operatorname{sinc}(0)=1$을 쓴다. 원 신호의 대역이 $f_s/2$ 미만이고 이상적 샘플링·무한한 샘플열을 가정한 복원식이다. 실제 DAC는 흔히 zero-order hold를 사용하므로 샘플 사이를 유지한 뒤 아날로그 복원 필터를 거친다.

각 sinc는 자기 샘플 위치에서는 1이고 다른 정수 샘플 위치에서는 0이다.

따라서 모든 샘플을 정확히 통과하는 연속 파형을 만든다.

---

### 34.1 복원식에 왜 sinc가 등장하는가?

앞 절의 이상적 복원 필터를 Hz 규약으로 쓰면 $H_r(F)=T_s$ for $\vert F \vert<f_s/2$, 그 밖에서는 0이다. 역변환하면

$$
h_r(t)=T_s\int_{-f_s/2}^{f_s/2}e^{j2\pi Ft}dF
=\operatorname{sinc}(t/T_s).
$$

$x_s(t)=\sum_nx[n]\delta(t-nT_s)$를 이 필터에 통과시키면

$$
x(t)=\sum_nx[n]\operatorname{sinc}\!\left(\frac{t-nT_s}{T_s}\right).
$$

**쉽게 말하면:** 각 샘플 자리에 높이가 그 샘플 값인 sinc를 놓고 모두 더한다. sinc는 자기 중심에서 1, 다른 정수 샘플 위치에서 0이므로 기존 샘플을 그대로 통과한다. 그 사이를 정확히 채운다는 결론은 신호가 대역제한되어 있다는 가정에서 나온다. 임의의 점들을 보간하는 모든 곡선이 원래 신호인 것은 아니다.

---

## 35. Quantization

$B$ bit quantizer는 보통

$$
\boxed{
L=2^B
}
$$

개의 레벨을 가진다.

비트수가 증가하면 더 작은 진폭 차이를 표현할 수 있다.

{% include signals-systems-visual.html kind="quantization" title="비트 수와 양자화 오차" %}

---

## 36. Quantization error

$$
\boxed{
e[n]=x[n]-x_q[n]
}
$$

라고 하자.

균일 양자화에서 step size가 $\Delta$라면 이상적인 nearest rounding 모델에서

$$
-\frac{\Delta}{2}
\le
e[n]
<
\frac{\Delta}{2}
$$

이다. 끝점의 포함 여부는 tie-breaking 규칙에 따라 달라지며 안전한 경계는 $\lvert e[n]\rvert\le\Delta/2$이다. 이 조건은 **입력이 양자화 범위를 넘지 않을 때**만 적용된다. 과부하·클리핑 오차는 이보다 훨씬 클 수 있다.

---

## 37. SQNR

이상적인 full-scale sinusoid와 균일 양자화 오차를 독립적 균일잡음으로 근사하면

$$
\boxed{
\operatorname{SQNR}
\approx
6.02B+1.76\,\mathrm{dB}
}
$$

가 된다.

유효 입력범위가 $[-A,A]$인 $B$비트 균일 양자화에서 $\Delta=2A/2^B$이다. 오차를 균일잡음으로 근사하면 분산은 $\Delta^2/12$, full-scale 사인파의 평균제곱은 $A^2/2$이므로 그 비율의 $10\log_{10}$을 취해 위 식을 얻는다. 작은 신호, 클리핑, 결정론적 오차, 비선형성에는 그대로 적용하지 않는다.

---

### 37.1 $6.02B+1.76$을 직접 유도하기

**쉽게 말하면:** 비트를 하나 늘리면 눈금 간격이 절반이 된다. 오차의 제곱은 대략 1/4이 되어 신호 대 오차 비가 약 4배, 즉 약 6 dB 좋아진다.

입력 범위가 $[-A,A]$이고 $B$비트 균일 양자화라면 $\Delta=2A/2^B$다. 과부하가 없고 오차를 $[-\Delta/2,\Delta/2]$에 균일하게 분포한 확률변수로 근사할 때

$$
P_e=\mathbb E[e^2]=\frac1\Delta\int_{-\Delta/2}^{\Delta/2}e^2de=\frac{\Delta^2}{12}.
$$

진폭 $A$인 full-scale 사인파의 평균전력은 $P_x=A^2/2$이므로

$$
\mathrm{SQNR}_{dB}
=10\log_{10}\frac{A^2/2}{(2A/2^B)^2/12}
=20B\log_{10}2+10\log_{10}(3/2)
\approx6.02B+1.76.
$$

이것은 모든 입력에 성립하는 정확한 법칙이 아니라 **균일 오차 모델과 full-scale 사인파라는 가정의 결과**다. 작은 신호, 클리핑, 신호와 강하게 상관된 양자화 오차에는 그대로 적용하지 않는다.

---

## 38. 이산시간 시스템

예를 들어

$$
y[n]
=
0.5x[n]
+
0.5x[n-1]
$$

은 현재 샘플과 직전 샘플의 평균이다.

고주파 변화가 완화되므로 간단한 low-pass 성질을 가진다.

---

## 39. Difference equation

$$
y[n]-0.8y[n-1]=x[n]
$$

은 과거 출력이 현재 출력에 영향을 준다.

연속시간 미분방정식이 시스템의 dynamics를 표현했던 것처럼, 차분방정식은 이산시간 시스템의 dynamics를 표현한다.

---

## 40. DTFT

$$
\boxed{
X(e^{j\omega})
=
\sum_{n=-\infty}^{\infty}
x[n]e^{-j\omega n}
}
$$

이다.

### 왜 $2\pi$ 주기인가?

$$
X(e^{j(\omega+2\pi)})
=
\sum_n
x[n]e^{-j(\omega+2\pi)n}
$$

인데

$$
e^{-j2\pi n}=1
$$

이므로

$$
\boxed{
X(e^{j(\omega+2\pi)})
=
X(e^{j\omega})
}
$$

이다.

---

역 DTFT는 $x[n]=(1/2\pi)\int_{-\pi}^{\pi}X(e^{j\omega})e^{j\omega n}\,d\omega$이다. 연속시간의 rad/s 주파수 $\Omega$와 이산시간의 rad/sample 주파수 $\omega$는 샘플링 시 $\omega=\Omega T_s$로 연결되며 $2\pi$를 법으로 같은 주파수를 나타낸다.

### 40.1 DTFT의 역변환을 확인하기

이산시간의 주파수가 $2\pi$주기인 이유는 각 샘플의 정수 인덱스 $n$에 대해 $e^{-j2\pi n}=1$이기 때문이다. **쉽게 말하면:** 정수 시각에서만 회전을 관찰하면, 샘플 사이에 추가로 한 바퀴 돈 회전과 원래 회전을 구별할 수 없다.

역변환식에 정변환을 넣어 실제로 원 샘플이 남는지 보자. 절대합 가능한 수열이면 합과 적분을 교환할 수 있다.

$$
\begin{aligned}
\frac1{2\pi}\int_{-\pi}^{\pi}X(e^{j\omega})e^{j\omega n}d\omega
&=\sum_m x[m]\frac1{2\pi}\int_{-\pi}^{\pi}e^{j\omega(n-m)}d\omega\\
&=\sum_m x[m]\delta[n-m]=x[n].
\end{aligned}
$$

$n=m$이면 안쪽 평균이 1, 다르면 정수 바퀴 회전의 평균이 0이다. CTFS의 계수를 구할 때 썼던 직교성이 이번에는 시간 샘플을 골라낸다. **$1/(2\pi)$는 길이 $2\pi$ 구간의 평균을 만드는 계수**다.

---

## 41. Z transform

$$
\boxed{
X(z)
=
\sum_{n=-\infty}^{\infty}
x[n]z^{-n}
}
$$

이다.

DTFT는

$$
z=e^{j\omega}
$$

를 대입한 단위원 위의 값으로 볼 수 있다.

단, 단위원이 ROC에 포함되어야 한다.

---

### 41.1 Z 변환은 “크기 가중치를 넣은 DTFT”다

$z=re^{j\omega}$이면 $z^{-n}=r^{-n}e^{-j\omega n}$이므로 $X(z)$는 $x[n]r^{-n}$의 DTFT다. 연속시간에서 $e^{-\sigma t}$를 씌운 Laplace와 같은 아이디어다.

예를 들어 $x[n]=a^nu[n]$라면 등비급수로

$$
X(z)=\sum_{n=0}^{\infty}(az^{-1})^n=\frac1{1-az^{-1}},\qquad |z|>|a|.
$$

등비급수는 공비의 크기가 1보다 작아야 수렴하므로 ROC가 따라 나온다. **쉽게 말하면:** 식은 합의 값이고, ROC는 그 합을 실제로 계산해도 되는 범위다. 둘을 함께 줘야 원 수열을 결정할 수 있다.

DTFT는 $r=1$인 단위원에 해당한다. 위 예에서는 $\vert a \vert<1$일 때 단위원이 ROC 안에 들어간다. 따라서 인과적인 지수 수열의 감쇠, 절대합 가능성, DTFT의 존재가 연결된다.

---

## 42. ROC

ROC는 Z 변환 급수가 수렴하는 $z$의 영역이다.

같은 대수식이라도 ROC가 다르면 서로 다른 시간신호를 나타낼 수 있다.

따라서 Z 변환에서는

$$
\boxed{
\text{대수식}
+
\text{ROC}
}
$$

를 함께 봐야 한다.

---

예를 들어 $X(z)=1/(1-az^{-1})$ ($a\ne0$)은 ROC가 $\lvert z\rvert>\lvert a\rvert$이면 $a^nu[n]$, ROC가 $\lvert z\rvert<\lvert a\rvert$이면 $-a^nu[-n-1]$이다. 같은 극점이라도 오른쪽 수열과 왼쪽 수열의 해석이 달라진다.

## 43. Z-plane의 pole과 stability

인과적 rational discrete-time LTI 시스템이 BIBO stable이려면 pole이 모두 단위원 안에 있어야 한다.

$$
\boxed{
\lvert p_k\rvert<1
}
$$

이다.

연속시간에서 왼쪽 반평면의 pole이 감쇠를 만들었던 것처럼, 이산시간에서는 단위원 내부의 pole이 감쇠를 만든다.



---

# Part V. DFT · FFT · 디지털 필터

## 44. 왜 DFT가 필요한가?

DTFT는 $\omega$가 연속변수이므로 무한히 많은 주파수 값을 가진다.

하지만 컴퓨터에는 유한한 $N$개의 샘플만 있다.

그래서

$$
\boxed{
N\text{개의 시간 샘플}
\longrightarrow
N\text{개의 주파수 좌표}
}
$$

로 바꾸는 DFT를 사용한다.

---

## 45. DFT

정의는

$$
\boxed{
X[k]
=
\sum_{n=0}^{N-1}
x[n]
e^{-j2\pi kn/N}
}
$$

이다.

역변환은

$$
\boxed{
x[n]
=
\frac{1}{N}
\sum_{k=0}^{N-1}
X[k]
e^{j2\pi kn/N}
}
$$

이다.

### 왜 이 식이 나오는가?

$N$개의 샘플을 하나의 $N$차원 벡터라고 생각한다.

그리고

$$
e^{j2\pi kn/N}
$$

형태의 서로 직교하는 복소지수 벡터를 기저로 사용한다.

즉 DFT는 **직교하는 복소지수 기저로의 좌표변환**이다. 이 정규화에서 DTFS 계수는 $c_k=X[k]/N$이다.

길이 $N$인 블록 밖을 0으로 둔 수열을 $x_N[n]$라 하면 $X[k]=X_N(e^{j2\pi k/N})$이다. DFT 영역에서 곱하고 IDFT하면 길이 $N$의 **원형 합성곱**이 된다. 길이 $L$, $M$인 두 유한 수열의 선형 합성곱을 얻으려면 $N\ge L+M-1$로 zero padding하거나 overlap-add/save를 사용한다.

{% include signals-systems-visual.html kind="dft" title="시간 샘플과 DFT 스펙트럼" %}

---

### 45.1 DFT는 왜 $N$개만으로 정확히 되돌릴 수 있는가?

**쉽게 말하면:** $N$개의 숫자를 담은 상자를 다른 $N$개의 좌표로 다시 기록한다. 새로운 좌표축들이 서로 독립이고 원래 공간을 모두 채우면 정보가 사라지지 않는다. DFT의 주파수 축들은 바로 그런 축이다.

정수 $r$에 대해 $q=e^{j2\pi r/N}$라 놓자. $r$이 $N$의 배수가 아니면 $q\ne1$, $q^N=1$이므로 등비급수에서

$$
\sum_{k=0}^{N-1}e^{j2\pi kr/N}
=\frac{1-q^N}{1-q}=0.
$$

$r$이 $N$의 배수이면 모든 항이 1이라 합은 $N$이다. 따라서 DFT를 역변환식에 대입하면

$$
\begin{aligned}
\frac1N\sum_{k=0}^{N-1}X[k]e^{j2\pi kn/N}
&=\sum_{m=0}^{N-1}x[m]\frac1N\sum_{k=0}^{N-1}e^{j2\pi k(n-m)/N}\\
&=x[n],\qquad 0\le n<N.
\end{aligned}
$$

여기서는 무한급수의 수렴 문제가 없다. 유한한 합으로 역변환이 정확함을 증명했다. $1/N$은 자기 축과의 내적 $N$을 보정한다. DTFS는 이 계수를 정변환에 두어 $c_k=X[k]/N$로 정의한다.

**작은 예:** $N=4$, $x=[1,0,-1,0]$은 $\cos(2\pi n/4)$다. 직접 DFT를 계산하면 $X=[0,2,0,2]$이며

$$
x[n]=\frac14\left(2e^{j\pi n/2}+2e^{j3\pi n/2}\right)=\cos(\pi n/2).
$$

정수 $n$에서 두 번째 지수는 $e^{-j\pi n/2}$와 같다. 두 bin이 양·음 주파수 한 쌍이고, 정규화한 값은 각각 $1/2$다.

### 45.2 원형 합성곱이 나오는 이유

$X[k]H[k]$에 역DFT를 적용하고 두 정변환의 합을 전개하면 안쪽에

$$
\frac1N\sum_{k=0}^{N-1}e^{j2\pi k(n-m-r)/N}
$$

가 생긴다. 위 직교성에 의해 $n-m-r$가 $N$의 배수일 때만 1이다. 따라서 결과는

$$
y_N[n]=\sum_{m=0}^{N-1}x[m]h[(n-m)\bmod N].
$$

즉 끝을 넘어간 항이 앞으로 감긴다. 선형 합성곱의 길이는 $L+M-1$이므로 그 길이 이상으로 0을 채우면 감겨 겹칠 부분이 없어져 선형 결과와 일치한다. Zero padding 조건은 이 인덱스 계산에서 나온다.

**직접 설명해 보기:** “FFT를 하면 원 신호가 주기적이다”라는 말 대신, 유한 블록의 주기적 연장과 실제 관측 신호의 주기성을 구분해서 설명해 보자.

---

## 46. DFT bin과 주파수 해상도

$k$번 bin의 주파수는

$$
f_k
=
\frac{k}{N}f_s
$$

이다.

이 식은 $[0,f_s)$ 주파수 표기이다. 실수 신호의 양측 스펙트럼에서 $k>N/2$인 bin은 $(k-N)f_s/N$의 음의 주파수로 읽는다. 짝수 $N$의 $k=N/2$는 Nyquist bin이다.

이웃 bin 사이의 간격은

$$
\boxed{
\Delta f
=
\frac{f_s}{N}
}
$$

이다.

관측시간이

$$
T_{\mathrm{obs}}
=
NT_s
$$

이므로

$$
\boxed{
\Delta f
=
\frac{1}{T_{\mathrm{obs}}}
}
$$

이다.

이 값은 **DFT 격자 간격**이다. 가까운 두 주파수를 실제로 분리하는 능력은 관측시간뿐 아니라 창의 주엽 폭, SNR, 추정 방법에도 좌우된다. zero padding으로 격자만 촘촘히 하는 것과 긴 시간의 새 데이터를 얻는 것은 다르다.

---

## 47. Spectral leakage

무한히 이어지는 사인파에서 $N$개 샘플만 잘라낸 것은 시간영역에서 rectangular window를 곱한 것과 같다.

시간영역의 곱셈은 주파수영역에서 합성곱이므로 스펙트럼이 주변 주파수로 퍼진다.

이를 spectral leakage라 한다.

### 왜 FFT에서 한 주파수가 여러 bin에 보이는가?

관측 구간 안에서 정확히 정수 번 반복되는 주파수는 DFT 기저와 정확히 일치한다.

하지만 정수 번 반복되지 않으면 잘린 양 끝점이 서로 이어지지 않아 불연속처럼 보이고, 여러 DFT 기저가 필요해진다.

---

## 48. Window functions

대표적인 window:

- Rectangular
- Hann
- Hamming
- Blackman

window를 사용하면 side lobe를 낮출 수 있다.

하지만 main lobe는 넓어진다.

즉

$$
\boxed{
\text{누설 억제}
\longleftrightarrow
\text{주파수 분해능}
}
$$

사이의 trade-off가 있다.

{% include signals-systems-visual.html kind="window" title="Window에 따른 spectral leakage 비교" %}

---

### 48.1 왜 관측을 자르면 주파수가 번지는가?

실제 관측은 $x[n]$ 전체가 아니라 창 $w[n]$을 곱한 $x_w[n]=x[n]w[n]$이다. 한 복소 사인파 $x[n]=e^{j\omega_0n}$만 있어도

$$
X_w(e^{j\omega})=\sum_nw[n]e^{-j(\omega-\omega_0)n}=W(e^{j(\omega-\omega_0)}).
$$

즉 관측 결과는 한 점이 아니라 **창의 스펙트럼을 $\omega_0$로 옮긴 모양**이다. 길이 $N$ 직사각형 창이면 등비급수로

$$
W(e^{j\omega})=\sum_{n=0}^{N-1}e^{-j\omega n}
=e^{-j\omega(N-1)/2}\frac{\sin(N\omega/2)}{\sin(\omega/2)}.
$$

분모·분자가 함께 0인 곳은 극한값을 쓴다. $\omega_0$가 DFT bin에 정확히 맞으면 다른 bin들이 이 함수의 영점에 놓여 한 bin처럼 보인다. 맞지 않으면 여러 bin에서 0이 아닌 값을 읽어 leakage가 보인다.

**쉽게 말하면:** 짧게 잘라 듣는 행위 자체가 측정의 퍼짐을 만든다. 부드러운 창은 옆으로 새는 작은 봉우리를 낮추지만, 일반적으로 중심 봉우리를 넓힌다. 그래서 약한 톤을 찾는 능력과 가까운 두 톤을 구별하는 능력 사이에 선택이 생긴다. Zero padding은 같은 곡선을 더 촘촘하게 읽을 뿐 관측 시간을 늘리지 않는다.

---

## 49. Zero padding

샘플 뒤에 0을 추가하면 DFT 점의 개수가 증가한다.

그래서 그래프가 더 촘촘하고 부드럽게 보인다.

하지만 실제 관측시간은 증가하지 않는다.

따라서

$$
\boxed{
\text{zero padding}
\ne
\text{실제 주파수 해상도 증가}
}
$$

이다.

---

## 50. FFT

FFT는 새로운 변환이 아니다.

$$
\boxed{
\text{FFT}
=
\text{DFT를 빠르게 계산하는 알고리즘}
}
$$

직접 DFT를 계산하면 대략 $N^2$개의 곱셈이 필요하다.

대표적인 radix-2 FFT는 반복되는 복소지수 계산을 재사용하여 계산량을 대략

$$
O(N\log N)
$$

수준으로 줄인다.

---

### 50.1 FFT는 무엇을 생략해서 빨라지는가?

**쉽게 말하면:** 답을 대충 계산하는 것이 아니라, 같은 계산을 여러 번 하지 않도록 재사용한다. 짝수 길이 $N$의 DFT를 짝수 인덱스와 홀수 인덱스로 나누자. $W_N=e^{-j2\pi/N}$이면

$$
\begin{aligned}
X[k]&=\sum_{r=0}^{N/2-1}x[2r]W_N^{2rk}
+W_N^k\sum_{r=0}^{N/2-1}x[2r+1]W_N^{2rk}\\
&=E[k]+W_N^kO[k].
\end{aligned}
$$

$W_N^2=W_{N/2}$이므로 $E,O$는 각각 길이 $N/2$의 DFT다. 또한 $E,O$는 $N/2$주기이고 $W_N^{k+N/2}=-W_N^k$이므로

$$
X[k+N/2]=E[k]-W_N^kO[k].
$$

한 번 구한 두 작은 DFT로 앞·뒤 절반을 모두 얻는다. $N=2^m$이면 계속 반으로 나누어 $m=\log_2N$단계, 단계마다 $O(N)$ 연산이므로 전체가 $O(N\log N)$이다. 직접 DFT의 $N$개 출력 각각에 $N$항을 더하는 $O(N^2)$와 비교된다. 이것은 radix-2 FFT의 유도이며, 다른 길이에도 다른 FFT 알고리즘이 있다. 부동소수점 반올림을 제외하면 계산하는 수학적 변환은 같은 DFT다.

---

## 51. FIR filter

FIR은 finite impulse response다.

$$
\boxed{
y[n]
=
\sum_{k=0}^{M}
b_kx[n-k]
}
$$

이다.

위의 표준 직접형 FIR 구현은 입력의 현재값과 과거값을 가중합하며 출력 feedback을 쓰지 않는다. FIR의 정의는 구현 형태가 아니라 임펄스응답의 유한 길이이다. 재귀적으로 구현되는 FIR도 있으므로 feedback 여부만으로 분류하지 않는다.

임펄스응답은 유한 길이이므로 계수가 유한하면 BIBO 안정하다.

---

## 52. IIR filter

IIR은 infinite impulse response다.

일반적으로

$$
y[n]
=
\sum_{k=0}^{M}
b_kx[n-k]
-
\sum_{r=1}^{N}
a_ry[n-r]
$$

처럼 과거 출력이 다시 들어간다.

feedback 때문에 임펄스응답이 무한히 이어질 수 있다.

따라서 pole 위치를 확인해야 안정성을 판단할 수 있다.

---

## 53. FIR과 IIR 비교

| 특성 | FIR | IIR |
|---|---|---|
| 보통의 구현 | 비재귀 직접형 | 재귀형 |
| 임펄스응답 | 유한 | 일반적으로 무한 |
| 안정성 | 유한 계수에서 다루기 쉬움 | pole 확인 필요 |
| 선형위상 | 대칭계수로 가능 | 일반적으로 어렵다 |
| 같은 규격의 차수 | 상대적으로 큼 | 상대적으로 작음 |

---

## 54. 디지털 필터 사양

필터를 설계하려면 원하는 성능을 수치로 정해야 한다.

- passband
- stopband
- cutoff
- transition band
- ripple
- attenuation

예를 들어 음성에서 $4\,\mathrm{kHz}$ 이하를 보존하고 $6\,\mathrm{kHz}$ 이상을 줄이고 싶다면 $4$에서 $6\,\mathrm{kHz}$ 사이가 transition band다.

---

## 55. Moving average filter

$$
\boxed{
y[n]
=
\frac{1}{M}
\sum_{k=0}^{M-1}
x[n-k]
}
$$

이다.

임펄스응답은

$$
h[n]
=
\begin{cases}
1/M,&0\le n\le M-1,\\
0,&\text{그 외}
\end{cases}
$$

이다.

갑자기 한 샘플만 튀는 고주파성 변화는 주변 샘플과 평균되면서 줄어든다.

그래서 간단한 low-pass 성질을 가진다. 다만 이상적인 저역통과는 아니며 통과대역 처짐과 사이드로브가 있다.

$$
H(e^{j\omega})=e^{-j\omega(M-1)/2}\frac{\sin(M\omega/2)}{M\sin(\omega/2)}.
$$

$\omega=0$에서는 극한값이 1이다. 선형위상의 지연은 $(M-1)/2$샘플이고, $2\pi/M$의 배수인 주파수에 영점이 생긴다(DC와 동치인 점 제외).

---

### 55.1 평균을 내면 왜 고주파가 줄어드는가?

**쉽게 말하면:** 이웃한 값들이 거의 같으면 평균을 내도 그대로다. 반대로 $1,-1,1,-1$처럼 빠르게 바뀌면 서로 지워진다.

길이 $M$ 이동평균의 임펄스응답은 $h[n]=1/M$ for $0\le n<M$이므로

$$
\begin{aligned}
H(e^{j\omega})&=\frac1M\sum_{n=0}^{M-1}e^{-j\omega n}
=\frac1M\frac{1-e^{-jM\omega}}{1-e^{-j\omega}}\\
&=e^{-j\omega(M-1)/2}\frac{\sin(M\omega/2)}{M\sin(\omega/2)}.
\end{aligned}
$$

DC에서는 극한으로 $H(1)=1$이라 상수가 유지된다. 첫 양의 영점은 $M>1$일 때 $2\pi/M$이다. $M=2$라면 $y[n]=(x[n]+x[n-1])/2$라서 상수 1은 그대로 1, $(-1)^n$은 정확히 0이다. 다만 모든 높은 주파수를 단조롭게 제거하는 이상적 저역통과 필터는 아니다. 위 식에는 영점 사이의 sidelobe가 남는다.

---

## 56. Correlation

두 신호가 얼마나 비슷한지 이동량을 바꿔가며 측정하는 것이 correlation이다.

한 가지 이산시간 정의는

$$
\boxed{
R_{xy}[k]
=
\sum_{n=-\infty}^{\infty}
x[n]y^{\ast}[n-k]
}
$$

이다.

복소켤레가 들어가는 이유는 내적과 에너지 구조를 유지하기 위해서다.

### 왜 사용하는가?

- 알려진 패턴 검출
- radar echo delay 측정
- 통신 synchronization
- 주기 탐지
- 음향 delay 추정

에 사용한다.

{% include signals-systems-visual.html kind="correlation" title="두 신호의 이동과 correlation" %}

---

## 57. Autocorrelation과 PSD

에너지 신호의 상관합과 전력 신호의 상관함수를 구분해야 한다. 유한에너지 수열의 경우 앞 절의 정의로

$$
R_{xx}[k]=\sum_n x[n]x^*[n-k],
\qquad \mathcal F\{R_{xx}[k]\}=\lvert X(e^{j\omega})\rvert^2
$$

이고 오른쪽은 **에너지 스펙트럼 밀도(ESD)**이다.

광의정상(WSS) 확률과정에는 합 대신 기대값으로 자기상관을 정의한다.

$$
r_{xx}[k]=\mathbb E\{x[n]x^*[n-k]\},
\qquad
S_{xx}(e^{j\omega})=\sum_{k=-\infty}^{\infty}r_{xx}[k]e^{-j\omega k}.
$$

이것이 적절한 수렴 조건 또는 스펙트럼 측도의 의미에서 성립하는 Wiener–Khinchin 관계이며 $S_{xx}$는 **전력 스펙트럼 밀도(PSD)**이다. 평균전력은

$$
r_{xx}[0]=\frac{1}{2\pi}\int_{-\pi}^{\pi}S_{xx}(e^{j\omega})\,d\omega
$$

로 얻는다. 결정론적 전력 신호에는 존재할 때 시간평균 상관을 사용한다. 하나의 기록에서 계산한 periodogram은 PSD의 추정량이며 $\lvert\mathrm{FFT}\rvert^2$만 쓰면 샘플링 주파수·창 에너지에 따른 정규화가 빠진다. 예를 들어 양측 Hz 단위 periodogram의 정규화는 $\lvert\sum_nw[n]x[n]e^{-j2\pi fn/f_s}\rvert^2/(f_s\sum_nw[n]^2)$이다.

---

# Part VI. 전자공학 응용

## 58. 음성 신호 처리

마이크에서 스피커까지의 전형적인 흐름은

$$
\text{Microphone}
\rightarrow
\text{Analog LPF}
\rightarrow
\text{ADC}
\rightarrow
\text{DSP}
\rightarrow
\text{DAC}
\rightarrow
\text{Speaker}
$$

이다.

각 블록은 지금까지 배운 개념과 연결된다.

- Analog LPF: aliasing 방지
- ADC: sampling + quantization
- DSP: DFT, filter, correlation
- DAC: digital-to-analog
- reconstruction filter: 영상성분 제거

---

## 59. Audio equalizer

equalizer는 주파수 대역마다 서로 다른 gain을 적용한다.

$$
Y(e^{j\omega})
=
H(e^{j\omega})
X(e^{j\omega})
$$

에서 $H$를 조절하는 것이다.

저음을 키운다는 것은 낮은 주파수 대역에서 $\lvert H\rvert$를 크게 만드는 것이고, 고음을 줄인다는 것은 높은 주파수 대역에서 $\lvert H\rvert$를 낮추는 것이다.

---

## 60. Noise removal

관측 신호가

$$
y[n]=s[n]+v[n]
$$

라고 하자.

$s[n]$은 원하는 신호, $v[n]$은 잡음이다.

신호와 잡음의 주파수 대역이 다르면 filter로 일부 잡음을 줄일 수 있다.

하지만 둘이 같은 대역에 겹쳐 있으면 단순 주파수 필터만으로 완전히 분리할 수 없다.

이때는 통계적 방법, adaptive filtering, spectral estimation 등이 필요할 수 있다.

---

## 61. 통신과 신호 시스템

통신에서는 정보를 반송파에 싣기 위해 주파수 이동을 사용한다.

$$
m(t)e^{j\omega_ct}
\longleftrightarrow
M(\omega-\omega_c)
$$

이다.

직교하는 두 성분을 사용하면 I와 Q를 동시에 다룰 수 있다.

공업수학에서 배운 직교함수와 내적이 실제 수신기의 correlation detector로 연결되는 예다.

---

## 62. 이미지는 왜 신호인가?

흑백영상은

$$
x[m,n]
$$

이라는 2차원 이산신호다.

2차원 DFT를 사용하면 가로와 세로의 공간주파수로 분해할 수 있다.

- 낮은 공간주파수: 천천히 변하는 밝기
- 높은 공간주파수: 경계, 세부무늬, 질감

즉 영상처리도 신호처리의 확장이다.

---

## 63. 종합 프로젝트: 실제 음성 신호 처리

최종적으로 다음 흐름을 하나의 시스템으로 이해할 수 있어야 한다.

$$
\boxed{
\begin{aligned}
\text{Microphone}
&\longrightarrow
\text{AA Filter}\\
&\longrightarrow
\text{Sampling}\\
&\longrightarrow
\text{Quantization}\\
&\longrightarrow
\text{DFT/FFT}\\
&\longrightarrow
\text{Digital Filter}\\
&\longrightarrow
\text{IDFT/IFFT}\\
&\longrightarrow
\text{DAC}\\
&\longrightarrow
\text{Speaker}
\end{aligned}
}
$$

이 흐름은 FFT 기반 블록 처리를 선택한 경우의 예다. 모든 디지털 필터가 FFT를 필요로 하는 것은 아니다. 시간영역 FIR/IIR을 쓰면 샘플마다 차분방정식을 계산할 수 있다. FFT 기반 필터에서는 원형 합성곱과 블록 경계를 처리하고, 마지막에는 DAC의 복원 필터를 고려한다.

---

## 64. 공업수학에서 DSP까지 전체 연결

$$
\boxed{
\begin{array}{ccc}
\text{미적분}
&
\longrightarrow
&
\text{신호 변화율}
\\[4pt]
\text{미분방정식}
&
\longrightarrow
&
\text{시스템 시간응답}
\\[4pt]
\text{선형대수}
&
\longrightarrow
&
\text{상태공간·DFT}
\\[4pt]
\text{복소수}
&
\longrightarrow
&
\text{크기·위상}
\\[4pt]
\text{푸리에}
&
\longrightarrow
&
\text{스펙트럼·필터}
\\[4pt]
\text{라플라스}
&
\longrightarrow
&
\text{전달함수·극점}
\\[4pt]
\text{수열}
&
\longrightarrow
&
\text{차분방정식·DSP}
\end{array}
}
$$

전체 흐름을 다시 쓰면

$$
\boxed{
\text{공업수학}
\longrightarrow
\text{신호와 시스템}
\longrightarrow
\text{DSP}
\longrightarrow
\text{통신·제어·회로·영상}
}
$$

이다.

---

# 종합 연습문제

## 문제 1. 시스템 성질 판별

다음 시스템이 선형인지, 시불변인지, 인과적인지 판단하라.

$$
y(t)=x(t-2)+3x(t)
$$

### 풀이

두 항 모두 입력의 선형결합이므로 선형이다.

입력을 $t_0$만큼 이동하면

$$
x(t-t_0-2)+3x(t-t_0)
$$

가 되어 원 출력의 $t_0$ 이동과 같으므로 시불변이다.

또 현재 $t$와 과거 $t-2$의 입력만 사용하므로 미래 입력이 필요하지 않는다.

따라서 인과적이다.

---

## 문제 2. 합성곱

$$
x(t)=u(t)-u(t-1),
\qquad
h(t)=u(t)-u(t-1)
$$

의 합성곱을 구하라.

### 풀이

두 폭 1 직사각형의 겹치는 길이가 출력값이 된다.

$t<0$에서는 겹치지 않는다.

$0\le t<1$에서는 겹치는 길이가 $t$이다.

$1\le t<2$에서는 겹치는 길이가 $2-t$이다.

따라서

$$
\boxed{
y(t)=
\begin{cases}
0,&t<0,\\
t,&0\le t<1,\\
2-t,&1\le t<2,\\
0,&t\ge2
\end{cases}
}
$$

이다.

삼각형 파형이 된다.

---

## 문제 3. RC cutoff

$$
H(j\omega)
=
\frac{1}{1+j\omega RC}
$$

의 cutoff를 구하라.

### 풀이

magnitude는

$$
\lvert H(j\omega)\rvert
=
\frac{1}{\sqrt{1+(\omega RC)^2}}
$$

이다.

cutoff에서는 DC gain의 $1/\sqrt2$가 되므로

$$
\frac{1}{\sqrt{1+(\omega RC)^2}}
=
\frac{1}{\sqrt2}
$$

이다.

양변을 제곱하면

$$
1+(\omega RC)^2=2
$$

이므로

$$
\omega_c=\frac{1}{RC}
$$

이다.

따라서

$$
\boxed{
f_c=\frac{1}{2\pi RC}
}
$$

이다.

---

## 문제 4. Sampling

최대 주파수가 $3\,\mathrm{kHz}$인 대역제한 신호를 이상적으로 샘플링한다.

### 풀이

$$
B=3\,\mathrm{kHz}
$$

이므로

$$
f_s>2B
$$

에서

$$
\boxed{
f_s>6\,\mathrm{kHz}
}
$$

가 필요하다.

실제 시스템에서는 anti-aliasing filter의 transition band 때문에 더 높은 값을 선택한다.

---

## 문제 5. DFT bin

$$
f_s=8\,\mathrm{kHz},
\qquad
N=1024
$$

일 때 bin 간격을 구하라.

### 풀이

$$
\Delta f
=
\frac{f_s}{N}
=
\frac{8000}{1024}
$$

이므로

$$
\boxed{
\Delta f
=
7.8125\,\mathrm{Hz}
}
$$

이다.

---

## 문제 6. 이산시간 주기성

$$
x[n]=\cos\left(\frac{3\pi}{5}n\right)
$$

의 기본주기를 구하라.

### 풀이

주기 $N$은

$$
\frac{3\pi}{5}N
=
2\pi k
$$

를 만족해야 한다.

따라서

$$
3N=10k
$$

이다.

가장 작은 양의 정수해는 $k=3$, $N=10$이다.

따라서

$$
\boxed{
N_0=10
}
$$

이다.

---

## 문제 7. Moving average

$$
y[n]
=
\frac{x[n]+x[n-1]+x[n-2]}{3}
$$

의 임펄스응답을 구하라.

### 풀이

입력을

$$
x[n]=\delta[n]
$$

로 둔다.

그러면

$$
h[n]
=
\frac{
\delta[n]
+
\delta[n-1]
+
\delta[n-2]
}{3}
$$

이다.

즉

$$
h[n]=
\begin{cases}
1/3,&n=0,1,2,\\
0,&\text{그 외}
\end{cases}
$$

이다.

길이 3의 FIR filter다.

---

# 마지막 핵심 정리

## 핵심 1

신호는 정보를 담은 함수다.

## 핵심 2

시스템은 신호를 다른 신호로 바꾸는 규칙이다.

## 핵심 3

LTI 시스템은 임펄스응답과 합성곱으로 표현된다.

$$
\boxed{
y=x\ast h
}
$$

## 핵심 4

푸리에 해석은 신호를 주파수 성분으로 분해한다.

## 핵심 5

LTI 시스템은 각 주파수 성분에 복소수 gain을 곱한다.

$$
\boxed{
Y=HX
}
$$

## 핵심 6

샘플링은 시간축을 이산화하고 양자화는 진폭축을 이산화한다.

## 핵심 7

DFT는 유한한 샘플 벡터를 유한한 주파수 좌표로 바꾸는 변환이다.

## 핵심 8

DSP는 결국

$$
\boxed{
\text{신호를 표현하고}
\longrightarrow
\text{분해하고}
\longrightarrow
\text{필요한 성분을 바꾸고}
\longrightarrow
\text{다시 합치는 과정}
}
$$

이라고 볼 수 있다.
