---
layout: single
title: "Signals and Systems & Digital Signal Processing"
categories: Math
tags: Math
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

### 4.2 단위 계단 신호

$$
u(t)=
\begin{cases}
0, & t<0,\\
1, & t>0
\end{cases}
$$

특정 시각부터 입력이 켜지는 상황을 표현한다.

예를 들어 $t=2$에서 $5\,\mathrm{V}$가 켜지면

$$
x(t)=5u(t-2)
$$

이다.

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

왜 배우는가? LTI 시스템에 $\delta(t)$를 넣었을 때의 출력 $h(t)$만 알면 그 시스템의 모든 입력에 대한 출력을 구할 수 있기 때문이다.

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

### 4.5 실수 지수신호

$$
x(t)=e^{at}
$$

에서

- $a<0$: 감쇠
- $a=0$: 상수
- $a>0$: 성장

이다.

공업수학에서 안정성을 고유값 실수부로 판단했던 이유와 같은 구조다.

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

{% include signals-systems-visual.html kind="basic-signals" title="단위계단 · 램프 · 지수 · 사인 신호" %}

---

## 5. 신호의 기본 연산

### 5.1 진폭 스케일링

$$
y(t)=Ax(t)
$$

### 5.2 시간 이동

$$
y(t)=x(t-t_0)
$$

은 오른쪽으로 $t_0$만큼 이동한다.

### 5.3 시간 반전

$$
y(t)=x(-t)
$$

는 좌우 반전이다.

### 5.4 시간 스케일링

$$
y(t)=x(at)
$$

에서

- $\lvert a\rvert>1$: 압축
- $0<\lvert a\rvert<1$: 확대
- $a<0$: 시간반전 포함

이다.

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

의 총에너지는 무한하지만 평균전력은

$$
\boxed{
P_x=\frac{A^2}{2}
}
$$

이다.

---

## 8. 이산시간 기본 신호

단위샘플:

$$
\delta[n]=
\begin{cases}
1,&n=0,\\
0,&n\ne0
\end{cases}
$$

단위계단:

$$
u[n]=
\begin{cases}
1,&n\ge0,\\
0,&n<0
\end{cases}
$$

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

LTI가 중요한 이유는 임펄스응답 하나로 시스템 전체를 표현할 수 있기 때문이다.

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

같은 시스템은 여러 관점으로 볼 수 있다.

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

{% include signals-systems-visual.html kind="filter" title="RC 저역통과 필터: 시간응답과 주파수응답" %}



---

# Part III. 주파수영역

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

이 성질 때문에 Fourier 해석이 LTI 시스템에 특히 잘 맞는다.

---

## 22. 푸리에 급수의 시스템 해석

주기신호를

$$
x(t)
=
\sum_{k=-\infty}^{\infty}
c_k e^{jk\omega_0t}
$$

로 나타낼 수 있다.

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

## 23. 연속시간 푸리에 변환

비주기신호는 고조파 간격이 이산적이지 않다.

따라서 주파수도 연속변수로 바뀐다.

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

이다.

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

$a>0$이면 시간응답에

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
\text{Anti-aliasing Filter}
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

각 sinc는 자기 샘플 위치에서는 1이고 다른 정수 샘플 위치에서는 0이다.

따라서 모든 샘플을 정확히 통과하는 연속 파형을 만든다.

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

이다.

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

이 식은 모든 실제 신호에 정확히 적용되는 절대법칙이 아니라 특정 가정에서의 근사다.

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

즉 DFT는 새로운 신비한 계산이 아니라 **벡터의 좌표변환**이다.

{% include signals-systems-visual.html kind="dft" title="시간 샘플과 DFT 스펙트럼" %}

---

## 46. DFT bin과 주파수 해상도

$k$번 bin의 주파수는

$$
f_k
=
\frac{k}{N}f_s
$$

이다.

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

즉 실제 주파수 분해능을 높이려면 관측시간을 늘려야 한다.

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

입력의 현재값과 과거값만 사용하고 출력 feedback은 없다.

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
| feedback | 없음 | 있음 |
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

그래서 간단한 low-pass 성질을 가진다.

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

자기 자신과 correlation하면

$$
R_{xx}[k]
$$

이고 autocorrelation이라 한다.

적절한 조건에서 power spectral density와 Fourier 변환 관계를 가진다.

$$
\boxed{
S_{xx}(e^{j\omega})
=
\sum_{k=-\infty}^{\infty}
R_{xx}[k]e^{-j\omega k}
}
$$

이다.

즉 시간차에 따른 자기 유사도와 주파수별 평균전력은 서로 연결되어 있다.

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
\text{Anti-aliasing Filter}\\
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

이 프로젝트는 과목 전체를 한 번에 복습하는 데 가장 좋다.

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
