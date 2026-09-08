---
layout: single
title: "Laplace Transform"
categories: Math
tags: Math
toc: true
author_profile: false
comments: true
---

<style>
.laplace-concept-box {
  border: 1px solid rgba(127,127,127,.35);
  border-radius: 12px;
  padding: 18px 20px;
  margin: 24px 0;
  background: rgba(127,127,127,.07);
}

.laplace-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 24px 0;
}

.laplace-flow-card {
  min-width: 150px;
  padding: 14px 18px;
  text-align: center;
  border: 1px solid rgba(127,127,127,.35);
  border-radius: 10px;
  background: rgba(127,127,127,.07);
}

.laplace-flow-arrow {
  font-size: 1.4rem;
  opacity: .7;
}

.laplace-key {
  font-weight: 700;
}

.laplace-svg-wrap {
  overflow-x: auto;
  text-align: center;
  margin: 24px 0;
}

.laplace-caption {
  margin-top: 8px;
  font-size: .9rem;
  opacity: .8;
  text-align: center;
}
</style>


라플라스 변환(Laplace Transform)은 처음 보면 다소 이상한 공식으로 보인다.

$$
F(s)
=
\int_0^\infty f(t)e^{-st}\,dt
$$

왜 갑자기 함수에 $e^{-st}$를 곱하는가?

왜 $0$부터 $\infty$까지 적분하는가?

그리고 원래 변수 $t$와 전혀 달라 보이는 $s$는 무엇인가?

이 장에서는 이 공식을 처음부터 외우지 않는다.

먼저 우리가 해결하고 싶은 문제를 생각하고, 그 문제를 쉽게 만들려면 어떤 성질을 가진 도구가 필요한지부터 생각한다.

그 과정을 따라가면

$$
s,\qquad e^{st},\qquad e^{-st},
$$

그리고 라플라스 변환의 정의가 서로 따로 떨어진 공식이 아니라 하나의 흐름으로 연결되어 있다는 것을 알 수 있다.

<div class="laplace-flow">
  <div class="laplace-flow-card">
    시간영역<br>
    미분방정식
  </div>
  <div class="laplace-flow-arrow">→</div>
  <div class="laplace-flow-card">
    Laplace<br>
    Transform
  </div>
  <div class="laplace-flow-arrow">→</div>
  <div class="laplace-flow-card">
    $s$영역<br>
    대수방정식
  </div>
  <div class="laplace-flow-arrow">→</div>
  <div class="laplace-flow-card">
    Inverse<br>
    Transform
  </div>
  <div class="laplace-flow-arrow">→</div>
  <div class="laplace-flow-card">
    시간영역의 해
  </div>
</div>

이 장에서는 다음 순서로 라플라스 변환을 살펴본다.

1. 라플라스 변환의 정의
2. 역변환과 도함수의 변환
3. 라플라스 변환의 성질
4. 특수함수의 라플라스 변환
5. 합성곱과 헤비사이드 전개
6. 라플라스 변환의 응용

---

## 1. 라플라스 변환의 정의

### 1.1 왜 라플라스 변환을 배우는가?

앞에서 미분방정식을 풀 때는 미분방정식의 형태에 따라 서로 다른 방법을 사용했다.

예를 들어

$$
y'+2y=3
$$

은 1계 선형 미분방정식이고,

$$
y''+3y'+2y=0
$$

은 상수계수 2계 선형 미분방정식이다.

회로에서도 같은 형태가 등장한다.

RC 회로에서는

$$
RC\frac{dv_C}{dt}+v_C=v_{\mathrm{in}}(t)
$$

이고 RLC 회로에서는

$$
LC\frac{d^2v_C}{dt^2}
+
RC\frac{dv_C}{dt}
+
v_C
=
v_{\mathrm{in}}(t)
$$

와 같은 식이 나온다.

문제는 미지수뿐 아니라

$$
y',\qquad y''
$$

와 같은 **미분 연산까지 함께 들어 있다는 것**이다.

만약 미분을 어떤 단순한 곱셈으로 바꿀 수 있다면 어떨까?

예를 들어

$$
\frac{d}{dt}
\quad\longrightarrow\quad
s
$$

라고 바꿀 수 있다고 생각해 보자.

그렇다면

$$
y'
\quad\longrightarrow\quad
sY
$$

이고

$$
y''
\quad\longrightarrow\quad
s^2Y
$$

가 된다.

그러면

$$
y''+3y'+2y=x(t)
$$

는 대략

$$
s^2Y+3sY+2Y=X
$$

즉,

$$
(s^2+3s+2)Y=X
$$

가 된다.

따라서

$$
Y=\frac{X}{s^2+3s+2}
$$

와 같이 **미분방정식이 대수방정식으로 바뀐다.**

<div class="laplace-concept-box">
<span class="laplace-key">라플라스 변환의 핵심 목적</span><br><br>
복잡한 시간 미분 연산을 $s$에 대한 곱셈으로 바꾸어,
미분방정식을 다항식과 분수 계산 문제로 바꾸는 것이다.
</div>

물론 실제 라플라스 변환에서는 초기조건 때문에

$$
\mathcal L\{y'\}
=
sY-y(0^-)
$$

처럼 추가항이 생긴다.

하지만 이것은 오히려 장점이다.

라플라스 변환은 초기조건을 없애는 것이 아니라 **계산식 안에 직접 포함시킨다.**

---

### 1.2 어떤 함수는 미분해도 모양이 변하지 않을까?

그러면 미분을 곱셈으로 바꾸는 방법을 찾아보자.

먼저 일반적인 함수를 미분해 보자.

$$
f(t)=t^2
$$

이면

$$
f'(t)=2t
$$

이다.

함수의 모양이 달라진다.

삼각함수는

$$
\frac{d}{dt}\sin\omega t
=
\omega\cos\omega t
$$

처럼 사인이 코사인으로 바뀐다.

하지만 지수함수는 특별하다.

$$
f(t)=e^{at}
$$

이면

$$
\frac{df}{dt}
=
ae^{at}
$$

이다.

즉,

$$
\boxed{
\frac{d}{dt}e^{at}
=
ae^{at}
}
$$

이다.

미분해도 함수의 형태가 바뀌지 않고 앞에 숫자 하나만 곱해진다.

한 번 더 미분하면

$$
\frac{d^2}{dt^2}e^{at}
=
a^2e^{at}
$$

이고 일반적으로

$$
\boxed{
\frac{d^n}{dt^n}e^{at}
=
a^ne^{at}
}
$$

이다.

이것이 미분방정식에서 지수함수가 끊임없이 등장하는 이유이다.

---

### 1.3 오히려 원하는 성질에서 지수함수를 직접 만들어 보자

이번에는 반대로 생각해 보자.

우리는 어떤 함수 $\phi(t)$를 미분했을 때

$$
\phi'(t)=s\phi(t)
$$

가 되기를 원한다.

즉 미분 결과가 원래 함수의 $s$배가 되는 함수를 찾는 것이다.

변수분리를 하면

$$
\frac{d\phi}{\phi}
=
s\,dt
$$

이고 적분하면

$$
\ln|\phi|
=
st+C
$$

이다.

따라서

$$
\phi(t)=Ce^{st}
$$

가 된다.

즉,

$$
\boxed{
\phi(t)=e^{st}
}
$$

는 미분연산의 모양을 그대로 유지하는 특별한 함수이다.

그리고

$$
\boxed{
\frac{d}{dt}e^{st}
=
se^{st}
}
$$

이다.

그래서 $s$는 단순한 문자 하나가 아니라

> **지수함수에 미분을 적용했을 때 앞에 나타나는 곱셈계수**

라고 생각할 수 있다.

---

### 1.4 그런데 왜 $s$는 실수가 아니라 복소수인가?

$s$를 실수 하나로만 두면 지수적인 성장과 감소는 표현할 수 있다.

예를 들어

$$
e^{-2t}
$$

는 감소하고

$$
e^{2t}
$$

는 증가한다.

하지만 공학에서는 진동도 매우 중요하다.

예를 들어

$$
\sin\omega t,\qquad
\cos\omega t
$$

가 있다.

Euler 공식은

$$
\boxed{
e^{j\omega t}
=
\cos\omega t+j\sin\omega t
}
$$

이다.

#### $e^{j\omega t}$를 실제로 그리면 어떤 모양일까?

여기서 한 가지를 확실하게 짚고 넘어가자.

$$
e^{j\omega t}
=
\cos\omega t+j\sin\omega t
$$

라고 해서 실제 전압이나 위치가 복소수라는 뜻은 아니다.

$e^{j\omega t}$는 **정현파를 계산하기 편하게 복소평면 위의 회전으로 표현한 것**이다.

복소수

$$
z=x+jy
$$

를 복소평면에 나타내면

- $x$: 실수축 좌표
- $y$: 허수축 좌표

가 된다.

따라서

$$
e^{j\omega t}
=
\cos\omega t+j\sin\omega t
$$

에서는 시간 $t$에 따라

$$
x(t)=\cos\omega t
$$

$$
y(t)=\sin\omega t
$$

인 점이 움직인다.

그런데

$$
x^2+y^2
=
\cos^2\omega t+\sin^2\omega t
=
1
$$

이므로 이 점은 항상 원점에서 거리가 1이다.

즉,

$$
\boxed{
e^{j\omega t}
=
\text{복소평면의 단위원 위를 회전하는 점}
}
$$

이라고 생각할 수 있다.

<div class="laplace-svg-wrap">
<svg width="520" height="360" viewBox="0 0 520 360"
     xmlns="http://www.w3.org/2000/svg"
     style="max-width:100%;">

  <!-- axes -->
  <line x1="55" y1="180" x2="465" y2="180"
        stroke="currentColor" stroke-width="2"/>
  <line x1="260" y1="330" x2="260" y2="30"
        stroke="currentColor" stroke-width="2"/>

  <!-- unit circle -->
  <circle cx="260" cy="180" r="120"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          opacity="0.35"/>

  <!-- rotating vector -->
  <line x1="260" y1="180" x2="345" y2="95"
        stroke="#4c9aff"
        stroke-width="3"/>

  <circle cx="345" cy="95" r="6"
          fill="#4c9aff"/>

  <!-- projections -->
  <line x1="345" y1="95" x2="345" y2="180"
        stroke="#ff7373"
        stroke-width="2"
        stroke-dasharray="5,5"/>

  <line x1="345" y1="95" x2="260" y2="95"
        stroke="#75d38b"
        stroke-width="2"
        stroke-dasharray="5,5"/>

  <!-- labels -->
  <text x="445" y="168"
        fill="currentColor"
        font-size="16">
    Re
  </text>

  <text x="273" y="45"
        fill="currentColor"
        font-size="16">
    Im
  </text>

  <text x="355" y="140"
        fill="#ff7373"
        font-size="15">
    cos(ωt)
  </text>

  <text x="270" y="87"
        fill="#75d38b"
        font-size="15">
    sin(ωt)
  </text>

  <text x="350" y="82"
        fill="#4c9aff"
        font-size="15">
    e^(jωt)
  </text>

</svg>

<div class="laplace-caption">
$e^{j\omega t}$는 복소평면에서 회전하고,
가로 좌표가 $\cos\omega t$, 세로 좌표가 $\sin\omega t$가 된다.
</div>
</div>

시간에 따라 몇 개의 점만 확인해 보면 더 명확하다.

| $t$ | $e^{j\omega t}$ | 복소평면 위치 |
|---|---|---|
| $0$ | $1$ | $(1,0)$ |
| $\frac{\pi}{2\omega}$ | $j$ | $(0,1)$ |
| $\frac{\pi}{\omega}$ | $-1$ | $(-1,0)$ |
| $\frac{3\pi}{2\omega}$ | $-j$ | $(0,-1)$ |
| $\frac{2\pi}{\omega}$ | $1$ | $(1,0)$ |

따라서 한 주기를 도는 데 필요한 시간은

$$
\boxed{
T=\frac{2\pi}{|\omega|}
}
$$

이다.

즉 $\omega$는 **복소평면에서 얼마나 빠르게 회전하는지를 결정한다.**

$\omega$가 커지면 더 빠르게 회전하고,
$\omega$가 작아지면 천천히 회전한다.

---

#### 원운동에서 cosine과 sine 파형이 나온다

복소평면에서 회전하는 점의 실수축 좌표만 시간에 따라 기록하면

$$
\boxed{
\operatorname{Re}
\left\{
e^{j\omega t}
\right\}
=
\cos\omega t
}
$$

가 된다.

반대로 허수축 좌표를 기록하면

$$
\boxed{
\operatorname{Im}
\left\{
e^{j\omega t}
\right\}
=
\sin\omega t
}
$$

이다.

즉 cosine과 sine은 서로 완전히 다른 운동이 아니라

**같은 원운동을 서로 수직인 두 방향에서 바라본 결과**이다.

<div class="laplace-concept-box">
<b>중요</b><br><br>

$e^{j\omega t}$ 자체가 실제 물리량이라는 뜻은 아니다.

실제 신호가

$$
x(t)=A\cos(\omega t+\phi)
$$

라면 계산할 때

$$
\tilde{x}(t)
=
Ae^{j(\omega t+\phi)}
$$

라는 복소수 표현을 사용하고,

마지막에

$$
\boxed{
x(t)
=
\operatorname{Re}\{\tilde{x}(t)\}
}
$$

를 취한다.

복소수는 실제 신호를 바꾸는 것이 아니라
진폭과 위상을 편하게 계산하기 위한 표현이다.
</div>

---

#### 왜 굳이 복소평면에서 회전시키는가?

cosine만 사용해도 하나의 정현파를 표현할 수 있다.

$$
x(t)
=
A\cos(\omega t+\phi)
$$

이 식만으로

- 진폭 $A$
- 각주파수 $\omega$
- 위상 $\phi$

를 모두 표현할 수 있다.

그런데 미분하면

$$
\frac{d}{dt}\cos\omega t
=
-\omega\sin\omega t
$$

처럼 cosine이 sine으로 바뀐다.

다시 미분하면

$$
\frac{d^2}{dt^2}\cos\omega t
=
-\omega^2\cos\omega t
$$

가 된다.

즉 미분할 때마다 sine과 cosine 사이를 계속 오가게 된다.

반면 복소지수는

$$
\frac{d}{dt}e^{j\omega t}
=
j\omega e^{j\omega t}
$$

이다.

함수의 형태는 그대로이고

$$
j\omega
$$

만 곱해진다.

따라서

$$
\boxed{
\frac{d}{dt}
\quad\longleftrightarrow\quad
j\omega
}
$$

처럼 미분을 단순한 곱셈으로 다룰 수 있다.

이것이 실제 정현파를 굳이 복소지수로 표현하는 가장 큰 이유이다.

---

#### $j$를 곱한다는 것은 무엇인가?

복소평면에서 $j$를 곱하는 것은 $90^\circ$ 회전시키는 것과 같다.

$$
1
\xrightarrow{\times j}
j
$$

$$
j
\xrightarrow{\times j}
-1
$$

$$
-1
\xrightarrow{\times j}
-j
$$

$$
-j
\xrightarrow{\times j}
1
$$

즉

$$
j^2=-1
$$

이라는 성질은 복소평면에서 두 번 $90^\circ$ 회전하여
$180^\circ$ 방향으로 이동한 것과 연결해서 볼 수 있다.

그래서

$$
\frac{d}{dt}e^{j\omega t}
=
j\omega e^{j\omega t}
$$

라는 식은

- 크기에는 $\omega$가 곱해지고
- 위상은 $90^\circ$ 이동한다

는 두 정보를 동시에 담고 있다.

실제로

$$
\frac{d}{dt}\cos\omega t
=
-\omega\sin\omega t
$$

이고

$$
-\sin\omega t
=
\cos\left(
\omega t+\frac{\pi}{2}
\right)
$$

이므로 cosine을 미분하면 위상이 $90^\circ$ 이동한다는 사실과 정확히 일치한다.

---

#### 시간축까지 같이 그리면 나선이 된다

지금까지는 복소평면만 바라봤다.

하지만 시간축 $t$까지 별도의 축으로 추가하면

$$
\left(
t,\,
\cos\omega t,\,
\sin\omega t
\right)
$$

라는 3차원 곡선이 된다.

{% include laplace-explorer.html kind="helix" %}

시간이 증가하면서 복소평면의 원을 계속 회전하므로 전체 모양은
스프링과 같은 **나선(Helix)**이 된다.

그래프에서 $\omega$를 증가시키면 같은 시간 동안 더 많은 회전을 하므로
나선이 더 촘촘해진다.
따라서

$$
e^{j\omega t}
$$

를 세 가지 방법으로 볼 수 있다.

| 바라보는 방법 | 보이는 형태 |
|---|---|
| 복소평면 $(\operatorname{Re},\operatorname{Im})$ | 원운동 |
| 시간-$\operatorname{Re}$ 평면 | cosine |
| 시간-$\operatorname{Im}$ 평면 | sine |
| 시간까지 포함한 3차원 | 나선 |

이 네 그림은 서로 다른 함수가 아니라 **같은 $e^{j\omega t}$를 서로 다른 방향에서 바라본 것**이다.

즉 **진동도 복소지수함수로 표현할 수 있다.**

이제 성장·감쇠와 진동을 동시에 표현하고 싶다면

$$
e^{\sigma t}
$$

와

$$
e^{j\omega t}
$$

를 곱하면 된다.

$$
e^{\sigma t}e^{j\omega t}
=
e^{(\sigma+j\omega)t}
$$

이다.

여기서

$$
\boxed{
s=\sigma+j\omega
}
$$

라고 정의한다.

$s$라는 문자를 사용하는 것 자체는 관례다.

중요한 것은 $s$가 복소수라는 점이다.

$$
\boxed{
e^{st}
=
e^{\sigma t}
\left(
\cos\omega t+j\sin\omega t
\right)
}
$$

이므로

- $\sigma$: 성장 또는 감쇠의 정도
- $\omega$: 진동의 각주파수

를 나타낸다.

<div class="laplace-svg-wrap">
<svg width="560" height="310" viewBox="0 0 560 310"
     xmlns="http://www.w3.org/2000/svg"
     style="max-width:100%;">
  <line x1="45" y1="155" x2="525" y2="155"
        stroke="currentColor" stroke-width="2"/>
  <line x1="280" y1="280" x2="280" y2="30"
        stroke="currentColor" stroke-width="2"/>

  <polygon points="525,155 513,149 513,161"
           fill="currentColor"/>
  <polygon points="280,30 274,42 286,42"
           fill="currentColor"/>

  <text x="505" y="145" fill="currentColor"
        font-size="17">σ</text>
  <text x="292" y="45" fill="currentColor"
        font-size="17">jω</text>

  <circle cx="185" cy="95" r="7" fill="#59a7ff"/>
  <text x="80" y="80" fill="currentColor"
        font-size="14">σ&lt;0 : 감쇠 진동</text>

  <circle cx="375" cy="95" r="7" fill="#ff7373"/>
  <text x="382" y="80" fill="currentColor"
        font-size="14">σ&gt;0 : 성장 진동</text>

  <circle cx="280" cy="90" r="7" fill="#75d38b"/>
  <text x="294" y="116" fill="currentColor"
        font-size="14">σ=0 : 일정 진폭</text>

  <text x="82" y="210" fill="currentColor"
        font-size="14">Left Half Plane</text>
  <text x="365" y="210" fill="currentColor"
        font-size="14">Right Half Plane</text>
</svg>
<div class="laplace-caption">
$s=\sigma+j\omega$에서 수평축은 감쇠·성장, 수직축은 진동을 나타낸다.
</div>
</div>

{% include laplace-explorer.html kind="mode" %}

위 그래프에서 $\sigma$와 $\omega$를 바꿔 보자.

- $\sigma<0$: 시간이 지나면서 진폭이 감소
- $\sigma=0$: 진폭이 일정
- $\sigma>0$: 시간이 지나면서 진폭이 증가
- $\omega=0$: 진동하지 않는 순수 지수함수
- $\vert \omega \vert$ 증가: 진동 속도 증가

중요한 것은

$$
\frac{d}{dt}e^{st}
=
se^{st}
$$

라는 성질이 $\sigma$와 $\omega $를 모두 포함한 상태에서도 그대로 유지된다는 것이다.

---

### 1.5 모든 $s$가 실제 시스템의 해가 되는 것은 아니다

$s$는 우리가 탐색하는 복소평면의 변수이다.

하지만 특정 미분방정식의 자연응답에 등장하는 $s$는 방정식이 결정한다.

예를 들어

$$
y''+2y'+5y=0
$$

에서

$$
y=e^{st}
$$

라고 가정하면

$$
s^2e^{st}
+
2se^{st}
+
5e^{st}
=
0
$$

이다.

$e^{st}\neq0$이므로

$$
s^2+2s+5=0
$$

이고

$$
s=-1\pm2j
$$

이다.

따라서 이 시스템의 자연응답은

$$
e^{(-1+2j)t},\qquad
e^{(-1-2j)t}
$$

에 해당한다.

즉,

> $s$는 복소평면 전체를 움직일 수 있는 변수이고,  
> 특성방정식의 근은 그중 실제 시스템이 선택한 특정 $s$이다.

---

### 1.6 이제 변환을 만들어 보자

지수함수가 미분에 대해 특별하다는 것은 알았다.

하지만 우리가 원하는 것은 $e^{st}$ 하나를 푸는 것이 아니라 임의의 함수 $f(t)$를 새로운 영역으로 옮기는 것이다.

함수의 여러 시간 값을 하나의 값으로 모으기 위해 어떤 가중함수 $K_s(t)$를 곱해서 적분한다고 생각해 보자.

$$
\mathcal T\{f\}(s)
=
\int_0^\infty
f(t)K_s(t)\,dt
$$

여기서 어떤 $K_s(t)$를 골라야 할까?

우리가 원하는 핵심 성질은

$$
f'(t)
$$

를 변환했을 때

$$
sF(s)
$$

가 나타나는 것이다.

미분된 함수에 위 변환을 적용하면

$$
\mathcal T\{f'\}
=
\int_0^\infty
f'(t)K_s(t)\,dt
$$

이다.

부분적분하면

$$
\begin{aligned}
\mathcal T\{f'\}
&=
\left[
f(t)K_s(t)
\right]_0^\infty
-
\int_0^\infty
f(t)K_s'(t)\,dt.
\end{aligned}
$$

우리는 마지막 적분이

$$
s\int_0^\infty f(t)K_s(t)\,dt
$$

가 되기를 원한다.

그러려면

$$
-K_s'(t)
=
sK_s(t)
$$

이면 된다.

즉

$$
\boxed{
K_s'(t)=-sK_s(t)
}
$$

이다.

이 1계 미분방정식의 해는

$$
K_s(t)
=
Ce^{-st}
$$

이다.

$K_s(0)=1$이 되도록 $C=1$로 정하면

$$
\boxed{
K_s(t)=e^{-st}
}
$$

가 된다.

따라서 $e^{-st}$는 갑자기 선택된 것이 아니다.

<div class="laplace-concept-box">
<span class="laplace-key">왜 $e^{-st}$인가?</span><br><br>
미분된 함수를 부분적분했을 때 다시 원래 변환 $F(s)$가 남게 만들려면
가중함수가 $K_s'=-sK_s$를 만족해야 한다.<br><br>
그 조건을 만족하는 함수가 바로 $e^{-st}$이다.
</div>

---

### 1.7 라플라스 변환의 정의

이제 라플라스 변환을 정의한다.

초기값 문제에서 주로 사용하는 단측 라플라스 변환은

$$
\boxed{
F(s)
=
\mathcal L\{f(t)\}
=
\int_{0^-}^{\infty}
f(t)e^{-st}\,dt
}
$$

이다.

여기서

$$
s=\sigma+j\omega
$$

이다.

보통 연속적인 함수에서는 $0^-$와 $0$의 차이가 없으므로

$$
F(s)
=
\int_0^\infty
f(t)e^{-st}\,dt
$$

라고 써도 된다.

$0^-$는 스위칭 직전 초기상태와 원점의 임펄스까지 일관되게 다루기 위한 표기이다.

---

### 1.8 $t$가 $s$로 바뀐다는 뜻이 아니다

다음 오해를 하면 안 된다.

$$
f(t)
\quad\longrightarrow\quad
F(s)
$$

라고 해서 단순히 문자 $t$를 $s$로 바꾼 것이 아니다.

$t$는 시간이다.

$s$는 어떤 지수 가중치를 사용해서 시간함수를 바라볼 것인지를 정하는 변수이다.

하나의 $s$를 고정하면

$$
F(s)
=
\int_0^\infty
f(t)e^{-st}\,dt
$$

를 계산해서 하나의 복소수를 얻는다.

$s$를 계속 바꾸면 복소평면 위에서 여러 값이 생기고, 이 전체가 함수 $F(s)$를 이룬다.

---

### 1.9 $e^{-st}$는 실제로 무엇을 하는가?

$s=\sigma+j\omega$를 대입하면

$$
e^{-st}
=
e^{-\sigma t}e^{-j\omega t}
$$

이다.

따라서 두 가지 역할을 동시에 한다.

#### 첫째: $e^{-\sigma t}$

시간이 멀어질수록 신호에 주는 가중치를 조절한다.

$\sigma>0$이면

$$
e^{-\sigma t}
$$

가 감소하므로 먼 시간의 값이 점점 작게 반영된다.

#### 둘째: $e^{-j\omega t}$

특정 각주파수로 회전하는 기준과 신호를 비교한다.

예를 들어

$$
f(t)=e^{j\omega_0t}
$$

이면

$$
f(t)e^{-j\omega t}
=
e^{j(\omega_0-\omega)t}
$$

이다.

$\omega=\omega_0$라면 회전이 사라진다.

$$
e^{j(\omega_0-\omega_0)t}=1
$$

반대로 주파수가 다르면 복소평면에서 계속 회전하며 적분 과정에서 서로 상쇄되는 효과가 생긴다.

---

### 1.10 수렴영역은 왜 필요한가?

무한 구간 적분이라고 해서 항상 값이 존재하는 것은 아니다.

예를 들어

$$
f(t)=e^{0.5t}
$$

라고 하자.

라플라스 적분의 내부는

$$
e^{0.5t}e^{-st}
=
e^{(0.5-\sigma)t}e^{-j\omega t}
$$

이다.

크기는

$$
\left|
e^{(0.5-\sigma)t}e^{-j\omega t}
\right|
=
e^{(0.5-\sigma)t}
$$

이다.

따라서

$$
\sigma>0.5
$$

이면 감소하지만,

$$
\sigma<0.5
$$

이면 증가한다.

그래서 이 함수의 라플라스 변환이 존재하는 조건은

$$
\boxed{
\operatorname{Re}(s)>0.5
}
$$

이다.

라플라스 적분이 수렴하는 $s$의 영역을

**수렴영역(Region of Convergence, ROC)**

이라고 한다.

{% include laplace-explorer.html kind="integral" %}

$s$의 실수부를 바꾸어 보면 적분 대상이 감쇠할 때는 누적 적분값이 한 점으로 수렴하지만, 감쇠가 충분하지 않으면 수렴하지 않는 것을 확인할 수 있다.

---

### 예제 1. 상수 함수의 라플라스 변환

$$
f(t)=1
$$

의 라플라스 변환을 정의에서 직접 구해 보자.

$$
F(s)
=
\int_0^\infty e^{-st}\,dt
$$

이다.

적분하면

$$
F(s)
=
\left[
-\frac1s e^{-st}
\right]_0^\infty.
$$

$\operatorname{Re}s>0$이면

$$
e^{-st}\to0
$$

이므로

$$
F(s)
=
0-\left(-\frac1s\right)
$$

이다.

따라서

$$
\boxed{
\mathcal L\{1\}
=
\frac1s
}
$$

이고 수렴영역은

$$
\boxed{
\operatorname{Re}s>0
}
$$

이다.

---

### 예제 2. 지수함수의 라플라스 변환

$$
f(t)=e^{at}
$$

라고 하자.

$$
\begin{aligned}
F(s)
&=
\int_0^\infty
e^{at}e^{-st}\,dt\\
&=
\int_0^\infty
e^{-(s-a)t}\,dt.
\end{aligned}
$$

따라서

$$
F(s)
=
\left[
-\frac{1}{s-a}
e^{-(s-a)t}
\right]_0^\infty.
$$

무한대에서 지수항이 사라지려면

$$
\operatorname{Re}(s-a)>0
$$

즉

$$
\operatorname{Re}s>a
$$

이어야 한다.

따라서

$$
\boxed{
\mathcal L\{e^{at}\}
=
\frac1{s-a}
}
$$

이다.

예를 들어

$$
e^{-2t}
\quad\longleftrightarrow\quad
\frac1{s+2}
$$

이다.

시간영역의 감쇠율 $-2$가 $s$영역에서는 분모의 근

$$
s=-2
$$

로 나타난다.

---

### 예제 3. $t$의 라플라스 변환

$$
\mathcal L\{t\}
=
\int_0^\infty
te^{-st}\,dt
$$

이다.

부분적분을 사용한다.

$$
u=t,
\qquad
dv=e^{-st}dt
$$

라 두면

$$
du=dt,
\qquad
v=-\frac1s e^{-st}
$$

이다.

따라서

$$
\begin{aligned}
\int_0^\infty te^{-st}dt
&=
\left[
-\frac{t}{s}e^{-st}
\right]_0^\infty
+
\frac1s
\int_0^\infty e^{-st}dt\\
&=
\frac1s\cdot\frac1s.
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{t\}
=
\frac1{s^2}
}
$$

이다.

일반적으로

$$
\boxed{
\mathcal L\{t^n\}
=
\frac{n!}{s^{n+1}}
}
$$

이다.

---

## 2. 역변환과 도함수의 변환

### 2.1 역라플라스 변환이란?

라플라스 변환은

$$
f(t)
\quad\longrightarrow\quad
F(s)
$$

로 이동하는 과정이다.

반대로 $F(s)$에서 원래 시간함수를 찾는 것을

**역라플라스 변환(Inverse Laplace Transform)**

이라고 한다.

$$
\boxed{
f(t)
=
\mathcal L^{-1}\{F(s)\}
}
$$

이다.

역변환은 대부분 이미 알고 있는 기본 변환쌍을 이용해서 계산한다.

---

### 2.2 기본 변환표

| $f(t)$ | $F(s)$ |
|---|---|
| $1$ | $\displaystyle \frac1s$ |
| $t$ | $\displaystyle \frac1{s^2}$ |
| $t^n$ | $\displaystyle \frac{n!}{s^{n+1}}$ |
| $e^{at}$ | $\displaystyle \frac1{s-a}$ |
| $\cos\omega t$ | $\displaystyle \frac{s}{s^2+\omega^2}$ |
| $\sin\omega t$ | $\displaystyle \frac{\omega}{s^2+\omega^2}$ |
| $\cosh at$ | $\displaystyle \frac{s}{s^2-a^2}$ |
| $\sinh at$ | $\displaystyle \frac{a}{s^2-a^2}$ |

이 표를 단순히 외우는 것보다 분모와 시간함수의 관계를 읽는 것이 중요하다.

예를 들어

$$
\frac1{s+3}
$$

에서는

$$
s+3=s-(-3)
$$

이므로

$$
\boxed{
\mathcal L^{-1}
\left\{
\frac1{s+3}
\right\}
=
e^{-3t}
}
$$

이다.

---

### 2.3 사인 함수의 공식은 왜 저렇게 생기는가?

Euler 공식을 이용하면

$$
\sin\omega t
=
\frac{
e^{j\omega t}
-
e^{-j\omega t}
}{2j}
$$

이다.

따라서 선형성을 이용하면

$$
\begin{aligned}
\mathcal L\{\sin\omega t\}
&=
\frac1{2j}
\left[
\frac1{s-j\omega}
-
\frac1{s+j\omega}
\right].
\end{aligned}
$$

통분하면

$$
\begin{aligned}
&=
\frac1{2j}
\frac{
(s+j\omega)-(s-j\omega)
}{
s^2+\omega^2
}\\
&=
\frac1{2j}
\frac{2j\omega}{s^2+\omega^2}.
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{\sin\omega t\}
=
\frac{\omega}{s^2+\omega^2}
}
$$

이다.

즉

$$
s^2+\omega^2
=
(s-j\omega)(s+j\omega)
$$

가 되는 이유도 시간영역의 진동이 복소극점

$$
s=\pm j\omega
$$

와 연결되기 때문이다.

---

### 2.4 역변환에서는 분자까지 맞춰야 한다

다음 함수를 보자.

$$
F(s)
=
\frac{3s+8}{s^2+4s+13}.
$$

분모를 완전제곱으로 만든다.

$$
s^2+4s+13
=
(s+2)^2+9.
$$

따라서

$$
F(s)
=
\frac{3s+8}{(s+2)^2+3^2}.
$$

분자도 $(s+2)$를 기준으로 바꾼다.

$$
3s+8
=
3(s+2)+2.
$$

따라서

$$
F(s)
=
3
\frac{s+2}{(s+2)^2+3^2}
+
2
\frac1{(s+2)^2+3^2}.
$$

사인 변환 공식은 분자에 $3$이 필요하므로

$$
2
\frac1{(s+2)^2+9}
=
\frac23
\frac3{(s+2)^2+9}.
$$

따라서

$$
\boxed{
f(t)
=
3e^{-2t}\cos3t
+
\frac23e^{-2t}\sin3t
}
$$

이다.

<div class="laplace-concept-box">
분모가 $(s+a)^2+\omega^2$라고 해서 무조건 사인 하나만 나오는 것이 아니다.<br><br>
분자의 $s+a$는 코사인에 대응하고,
분자의 $\omega$는 사인에 대응한다.
</div>

---

### 예제 1. 간단한 역변환

$$
F(s)
=
\frac5{s+4}
$$

이면

$$
\boxed{
f(t)=5e^{-4t}
}
$$

이다.

---

### 예제 2. 여러 항이 있는 경우

$$
F(s)
=
\frac2s
-
\frac3{s+1}
+
\frac4{s^2+4}
$$

이다.

각 항을 따로 역변환한다.

$$
\frac2s
\longrightarrow
2
$$

$$
-\frac3{s+1}
\longrightarrow
-3e^{-t}
$$

그리고

$$
\frac4{s^2+4}
=
2
\frac2{s^2+2^2}
$$

이므로

$$
\frac4{s^2+4}
\longrightarrow
2\sin2t.
$$

따라서

$$
\boxed{
f(t)
=
2-3e^{-t}+2\sin2t
}
$$

이다.

---

### 2.5 도함수의 라플라스 변환은 어디서 나오는가?

가장 중요한 공식 중 하나가

$$
\boxed{
\mathcal L\{f'(t)\}
=
sF(s)-f(0^-)
}
$$

이다.

이 식 역시 외우기 전에 직접 유도해 보자.

정의에서

$$
\mathcal L\{f'\}
=
\int_{0^-}^\infty
f'(t)e^{-st}\,dt
$$

이다.

부분적분한다.

$$
u=e^{-st},
\qquad
dv=f'(t)dt
$$

로 두면

$$
du=-se^{-st}dt,
\qquad
v=f(t)
$$

이다.

따라서

$$
\begin{aligned}
\mathcal L\{f'\}
&=
\left[
f(t)e^{-st}
\right]_{0^-}^{\infty}
+
s\int_{0^-}^\infty
f(t)e^{-st}\,dt.
\end{aligned}
$$

수렴영역에서

$$
f(t)e^{-st}\to0
$$

이라고 하면 무한대 경계항은 0이다.

따라서

$$
\boxed{
\mathcal L\{f'\}
=
sF(s)-f(0^-)
}
$$

이다.

여기서 초기값이 갑자기 추가된 것이 아니다.

**부분적분의 경계항에서 자연스럽게 등장한 것이다.**

---

### 2.6 두 번 미분하면 어떻게 되는가?

$$
\mathcal L\{f''\}
$$

에 방금 공식을 다시 적용한다.

$$
\mathcal L\{f''\}
=
s\mathcal L\{f'\}
-
f'(0^-).
$$

그리고

$$
\mathcal L\{f'\}
=
sF-f(0^-)
$$

이므로

$$
\begin{aligned}
\mathcal L\{f''\}
&=
s[sF-f(0^-)]
-
f'(0^-)\\
&=
s^2F
-
sf(0^-)
-
f'(0^-).
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{f''\}
=
s^2F(s)
-
sf(0^-)
-
f'(0^-)
}
$$

이다.

일반적으로

$$
\boxed{
\mathcal L\{f^{(n)}\}
=
s^nF(s)
-
\sum_{k=0}^{n-1}
s^{n-1-k}f^{(k)}(0^-)
}
$$

이다.

---

### 예제 3. 초기값 문제가 왜 쉬워지는가?

다음을 풀어보자.

$$
y''+3y'+2y=1
$$

초기조건은

$$
y(0)=1,
\qquad
y'(0)=0
$$

이다.

#### Step 1. 항별로 라플라스 변환

$$
\mathcal L\{y''\}
=
s^2Y-s
$$

이다.

$$
\mathcal L\{3y'\}
=
3(sY-1)
$$

이고

$$
\mathcal L\{2y\}=2Y
$$

이다.

우변은

$$
\mathcal L\{1\}
=
\frac1s.
$$

따라서

$$
(s^2Y-s)
+
3(sY-1)
+
2Y
=
\frac1s.
$$

#### Step 2. $Y(s)$를 정리

$$
(s^2+3s+2)Y
=
s+3+\frac1s.
$$

따라서

$$
Y
=
\frac{
s+3+1/s
}{
(s+1)(s+2)
}.
$$

분자와 분모에 $s$를 곱하면

$$
Y
=
\frac{s^2+3s+1}
{s(s+1)(s+2)}.
$$

#### Step 3. 부분분수 전개

$$
Y
=
\frac{A}{s}
+
\frac{B}{s+1}
+
\frac{C}{s+2}.
$$

계산하면

$$
A=\frac12,
\qquad
B=1,
\qquad
C=-\frac12.
$$

따라서

$$
Y
=
\frac1{2s}
+
\frac1{s+1}
-
\frac1{2(s+2)}.
$$

#### Step 4. 역변환

$$
\boxed{
y(t)
=
\frac12
+
e^{-t}
-
\frac12e^{-2t}
}
$$

이다.

#### Step 5. 검산

$t=0$이면

$$
y(0)
=
\frac12+1-\frac12
=
1
$$

이다.

미분하면

$$
y'
=
-e^{-t}+e^{-2t}
$$

이므로

$$
y'(0)=0.
$$

초기조건을 정확히 만족한다.

---

## 3. 라플라스 변환의 성질

### 3.1 선형성

라플라스 변환의 정의는 적분이므로 선형성을 가진다.

$$
\begin{aligned}
\mathcal L\{af+bg\}
&=
\int_0^\infty
[af(t)+bg(t)]e^{-st}dt\\
&=
aF(s)+bG(s).
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{af+bg\}
=
aF+bG
}
$$

이다.

---

### 예제 1. 선형성 이용

$$
f(t)
=
3+2e^{-t}-4\sin2t
$$

이면

$$
F(s)
=
3\frac1s
+
2\frac1{s+1}
-
4\frac2{s^2+4}.
$$

따라서

$$
\boxed{
F(s)
=
\frac3s
+
\frac2{s+1}
-
\frac8{s^2+4}
}
$$

이다.

---

### 3.2 시간영역에서 지수를 곱하면 왜 $s$가 이동하는가?

$$
\mathcal L\{f(t)\}
=
F(s)
$$

라고 하자.

시간영역에서 $e^{at}$를 곱하면

$$
\begin{aligned}
\mathcal L\{e^{at}f(t)\}
&=
\int_0^\infty
e^{at}f(t)e^{-st}dt\\
&=
\int_0^\infty
f(t)e^{-(s-a)t}dt.
\end{aligned}
$$

이것은 기존 $F(s)$에서 $s$ 대신 $s-a$를 넣은 것이다.

따라서

$$
\boxed{
\mathcal L\{e^{at}f(t)\}
=
F(s-a)
}
$$

이다.

---

### 예제 2. 감쇠 사인파

기본 변환은

$$
\sin3t
\longleftrightarrow
\frac3{s^2+9}
$$

이다.

여기에 $e^{-2t}$를 곱하면 $a=-2$이므로

$$
s\to s+2
$$

가 된다.

따라서

$$
\boxed{
\mathcal L\{e^{-2t}\sin3t\}
=
\frac3{(s+2)^2+9}
}
$$

이다.

시간영역에서 감쇠 $e^{-2t}$가 붙으면 $s$영역의 극점은

$$
\pm3j
$$

에서

$$
-2\pm3j
$$

로 이동한다.

---

### 3.3 시간 지연은 왜 $e^{-as}$가 되는가?

이번에는 완전히 다른 연산이다.

함수를 $a$초 늦게 시작시키자.

$$
u(t-a)f(t-a)
$$

이다.

라플라스 변환하면

$$
\int_a^\infty
f(t-a)e^{-st}dt.
$$

변수를

$$
\tau=t-a
$$

로 바꾸면

$$
t=\tau+a
$$

이므로

$$
\begin{aligned}
&=
\int_0^\infty
f(\tau)e^{-s(\tau+a)}d\tau\\
&=
e^{-as}
\int_0^\infty
f(\tau)e^{-s\tau}d\tau.
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L
\{
u(t-a)f(t-a)
\}
=
e^{-as}F(s)
}
$$

이다.

<div class="laplace-concept-box">
<b>주의</b><br><br>
$F(s-a)$와 $e^{-as}F(s)$는 전혀 다른 의미이다.<br><br>

$F(s-a)$ : 시간함수에 지수함수를 곱함<br>
$e^{-as}F(s)$ : 시간축에서 파형 자체를 $a$초 지연함
</div>

---

### 예제 3. 2초 늦게 시작하는 램프

기본 램프는

$$
f(t)=t
$$

이고

$$
F(s)=\frac1{s^2}
$$

이다.

2초 늦게 시작하면

$$
(t-2)u(t-2)
$$

이다.

따라서

$$
\boxed{
\mathcal L\{(t-2)u(t-2)\}
=
\frac{e^{-2s}}{s^2}
}
$$

이다.

반면

$$
tu(t-2)
$$

는 다른 함수이다.

$t=2$에서 값이 2로 시작한다.

$$
t=(t-2)+2
$$

이므로

$$
tu(t-2)
=
(t-2)u(t-2)
+
2u(t-2).
$$

따라서

$$
\boxed{
\mathcal L\{tu(t-2)\}
=
e^{-2s}
\left(
\frac1{s^2}
+
\frac2s
\right)
}
$$

이다.

---

### 3.4 시간에서 $t$를 곱하면 왜 $s$에 대해 미분하는가?

정의에서

$$
F(s)
=
\int_0^\infty
f(t)e^{-st}dt
$$

이다.

$s$에 대해 미분하면

$$
\begin{aligned}
\frac{dF}{ds}
&=
\int_0^\infty
f(t)
\frac{\partial}{\partial s}
e^{-st}
dt\\
&=
-\int_0^\infty
tf(t)e^{-st}dt.
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{tf(t)\}
=
-\frac{dF}{ds}
}
$$

이다.

---

### 예제 4. $te^{-at}$

$$
e^{-at}
\longleftrightarrow
\frac1{s+a}
$$

이므로

$$
\mathcal L\{te^{-at}\}
=
-\frac{d}{ds}
\frac1{s+a}.
$$

따라서

$$
\boxed{
\mathcal L\{te^{-at}\}
=
\frac1{(s+a)^2}
}
$$

이다.

일반적으로

$$
\boxed{
\mathcal L\{t^ne^{-at}\}
=
\frac{n!}{(s+a)^{n+1}}
}
$$

이다.

---

### 3.5 시간 적분은 왜 $1/s$를 곱하는가?

$$
g(t)
=
\int_0^t
f(\tau)d\tau
$$

라고 하자.

그러면

$$
g'(t)=f(t)
$$

이고

$$
g(0)=0
$$

이다.

도함수의 변환을 사용하면

$$
sG(s)-g(0)=F(s)
$$

이다.

따라서

$$
sG(s)=F(s)
$$

이고

$$
\boxed{
G(s)
=
\frac{F(s)}s
}
$$

이다.

즉

$$
\boxed{
\mathcal L
\left\{
\int_0^t f(\tau)d\tau
\right\}
=
\frac{F(s)}s
}
$$

이다.

---

### 3.6 시간축 압축과 확장

$b>0$일 때

$$
f(bt)
$$

를 생각하자.

$$
\mathcal L\{f(bt)\}
=
\int_0^\infty
f(bt)e^{-st}dt.
$$

$$
\tau=bt
$$

라고 두면

$$
dt=\frac{d\tau}{b}
$$

이다.

따라서

$$
\boxed{
\mathcal L\{f(bt)\}
=
\frac1b
F\left(\frac{s}{b}\right)
}
$$

이다.

$b>1$이면 시간축에서 더 빨리 진행되므로 파형이 압축된다.

---

### 3.7 초기값 정리

통상적인 조건에서

$$
\boxed{
f(0^+)
=
\lim_{s\to\infty}
sF(s)
}
$$

이다.

예를 들어

$$
F(s)
=
\frac5{s+2}
$$

이면

$$
\lim_{s\to\infty}
\frac{5s}{s+2}
=
5.
$$

실제로

$$
f(t)=5e^{-2t}
$$

이므로

$$
f(0^+)=5.
$$

---

### 3.8 최종값 정리

적절한 안정성 조건에서

$$
\boxed{
\lim_{t\to\infty}f(t)
=
\lim_{s\to0}
sF(s)
}
$$

이다.

하지만 단순히 $s=0$을 넣으면 되는 것은 아니다.

기약형 $sF(s)$의 극점들이 열린 좌반평면에 있어야 한다.

---

### 예제 5. 최종값 정리를 사용할 수 있는 경우

$$
F(s)
=
\frac1{s(s+1)}
$$

이면

$$
sF(s)
=
\frac1{s+1}.
$$

극점은

$$
s=-1
$$

이므로 안정하다.

따라서

$$
\lim_{t\to\infty}f(t)
=
1.
$$

실제로

$$
f(t)=1-e^{-t}
$$

이다.

---

### 예제 6. 최종값 정리를 사용하면 안 되는 경우

$$
F(s)
=
\frac1{s^2+1}
$$

은

$$
f(t)=\sin t
$$

이다.

형식적으로

$$
\lim_{s\to0}sF(s)=0
$$

이지만 실제 $\sin t$에는 최종값이 없다.

왜냐하면 극점

$$
s=\pm j
$$

가 허수축에 있기 때문이다.

---

## 4. 특수함수의 라플라스 변환

### 4.1 단위계단 함수가 필요한 이유

실제 입력은 $t=0$부터 항상 같은 식으로 주어지는 경우만 있는 것이 아니다.

예를 들어

- 2초 뒤에 스위치를 켬
- 5초 동안만 전압을 인가
- 특정 순간에 힘을 가함

같은 상황이 있다.

이러한 입력을 표현하기 위해 단위계단 함수와 임펄스를 사용한다.

단위계단 함수는

$$
u(t)
=
\begin{cases}
0,&t<0,\\
1,&t>0
\end{cases}
$$

이다.

그래프로 보면 다음과 같다.

<div class="laplace-svg-wrap">
<svg width="600" height="250" viewBox="0 0 600 250"
     xmlns="http://www.w3.org/2000/svg"
     style="max-width:100%;">
  <line x1="40" y1="195" x2="560" y2="195"
        stroke="currentColor" stroke-width="2"/>
  <line x1="150" y1="220" x2="150" y2="30"
        stroke="currentColor" stroke-width="2"/>

  <text x="548" y="185" fill="currentColor">t</text>
  <text x="160" y="45" fill="currentColor">u(t)</text>

  <line x1="40" y1="195" x2="150" y2="195"
        stroke="#59a7ff" stroke-width="4"/>
  <line x1="150" y1="95" x2="550" y2="95"
        stroke="#59a7ff" stroke-width="4"/>

  <line x1="150" y1="195" x2="150" y2="95"
        stroke="#59a7ff" stroke-width="2"
        stroke-dasharray="5,5"/>

  <text x="126" y="214" fill="currentColor">0</text>
  <text x="130" y="90" fill="currentColor">1</text>
</svg>
<div class="laplace-caption">
$t=0$에서 0에서 1로 켜지는 단위계단 함수
</div>
</div>

---

### 4.2 단위계단 함수의 변환

$t\ge0$에서는 $u(t)=1$이므로

$$
\mathcal L\{u(t)\}
=
\int_0^\infty e^{-st}dt.
$$

따라서

$$
\boxed{
\mathcal L\{u(t)\}
=
\frac1s
}
$$

이다.

$a$초에 켜지는 계단은

$$
u(t-a)
$$

이고 시간지연 성질에 의해

$$
\boxed{
\mathcal L\{u(t-a)\}
=
\frac{e^{-as}}s
}
$$

이다.

---

### 예제 1. 3초 뒤에 5V를 인가하는 입력

$$
v(t)
=
5u(t-3)
$$

이다.

따라서

$$
\boxed{
V(s)
=
\frac{5e^{-3s}}s
}
$$

이다.

$e^{-3s}$가 바로 **3초 지연 정보**이다.

---

### 4.3 직사각형 펄스

진폭 $A$인 신호가 $t=a$에서 켜지고 $t=b$에서 꺼진다고 하자.

이는

$$
\boxed{
p(t)
=
A[u(t-a)-u(t-b)]
}
$$

로 표현할 수 있다.

왜 뺄까?

- $t<a$: 두 계단 모두 0
- $a<t<b$: 첫 계단만 1
- $t>b$: 두 계단 모두 1이므로 서로 상쇄

된다.

<div class="laplace-svg-wrap">
<svg width="600" height="250" viewBox="0 0 600 250"
     xmlns="http://www.w3.org/2000/svg"
     style="max-width:100%;">
  <line x1="40" y1="195" x2="560" y2="195"
        stroke="currentColor" stroke-width="2"/>
  <line x1="70" y1="220" x2="70" y2="30"
        stroke="currentColor" stroke-width="2"/>

  <line x1="70" y1="195" x2="180" y2="195"
        stroke="#59a7ff" stroke-width="4"/>
  <line x1="180" y1="85" x2="410" y2="85"
        stroke="#59a7ff" stroke-width="4"/>
  <line x1="410" y1="195" x2="550" y2="195"
        stroke="#59a7ff" stroke-width="4"/>

  <line x1="180" y1="195" x2="180" y2="85"
        stroke="#59a7ff" stroke-width="2"
        stroke-dasharray="5,5"/>
  <line x1="410" y1="85" x2="410" y2="195"
        stroke="#59a7ff" stroke-width="2"
        stroke-dasharray="5,5"/>

  <text x="172" y="215" fill="currentColor">a</text>
  <text x="402" y="215" fill="currentColor">b</text>
  <text x="82" y="78" fill="currentColor">A</text>
</svg>
<div class="laplace-caption">
펄스 = 켜는 계단 − 끄는 계단
</div>
</div>

라플라스 변환은

$$
\boxed{
P(s)
=
\frac{A}{s}
\left(
e^{-as}-e^{-bs}
\right)
}
$$

이다.

---

### 예제 2. 2초부터 5초까지 10V

$$
v(t)
=
10[u(t-2)-u(t-5)]
$$

이다.

따라서

$$
\boxed{
V(s)
=
\frac{10}{s}
\left(
e^{-2s}-e^{-5s}
\right)
}
$$

이다.

---

### 4.4 구간별 함수를 계단함수로 바꾸는 방법

다음 함수를 생각하자.

$$
f(t)
=
\begin{cases}
0,&0\le t<1,\\
t-1,&1\le t<3,\\
2,&t\ge3.
\end{cases}
$$

$t=1$에서 램프가 시작된다.

$$
(t-1)u(t-1)
$$

이다.

하지만 이 램프는 $t=3$ 이후에도 계속 증가한다.

$t=3$ 이후 기울기를 없애려면

$$
(t-3)u(t-3)
$$

를 빼면 된다.

따라서

$$
\boxed{
f(t)
=
(t-1)u(t-1)
-
(t-3)u(t-3)
}
$$

이다.

라플라스 변환은

$$
\boxed{
F(s)
=
\frac{e^{-s}-e^{-3s}}{s^2}
}
$$

이다.

---

### 4.5 Dirac 델타 함수는 왜 필요한가?

아주 짧은 시간 동안 매우 큰 힘을 가하는 상황을 생각해 보자.

예를 들어 망치로 물체를 순간적으로 치거나, 회로에 매우 짧은 전압 펄스를 인가하는 경우이다.

펄스의 폭을 계속 줄이면서 총 면적을 1로 유지하자.

$$
p_\varepsilon(t)
=
\begin{cases}
1/\varepsilon,&0<t<\varepsilon,\\
0,&\text{그 외}
\end{cases}
$$

이면 면적은

$$
\int_0^\varepsilon
\frac1\varepsilon dt
=
1
$$

이다.

$\varepsilon\to0$인 극한을 이상화한 것이

**Dirac delta**

$$
\delta(t)
$$

이다.

델타는 보통의 함수처럼 특정 점의 높이를 이용해 이해하면 안 된다.

핵심은 면적이다.

$$
\boxed{
\int_{-\infty}^{\infty}
\delta(t)dt
=
1
}
$$

이다.

---

### 4.6 델타의 표본 추출 성질

$$
\boxed{
\int_{-\infty}^{\infty}
\delta(t-a)f(t)dt
=
f(a)
}
$$

이다.

즉 델타는 적분 안에서 특정 시점의 값만 골라낸다.

따라서 라플라스 변환하면

$$
\begin{aligned}
\mathcal L\{\delta(t-a)\}
&=
\int_0^\infty
\delta(t-a)e^{-st}dt\\
&=
e^{-as}.
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{\delta(t-a)\}
=
e^{-as}
}
$$

이다.

특히

$$
\boxed{
\mathcal L\{\delta(t)\}
=
1
}
$$

이다.

---

### 4.7 계단을 미분하면 왜 델타인가?

단위계단은 원점을 제외하면 일정하다.

따라서 보통의 구간에서는

$$
u'(t)=0
$$

처럼 보인다.

하지만 $t=0$에서 값이 0에서 1로 순간적으로 변한다.

도함수를 원점 주변에서 적분하면 전체 변화량 1이 나와야 한다.

그래서 일반화된 함수의 의미에서

$$
\boxed{
\frac{d}{dt}u(t)
=
\delta(t)
}
$$

이다.

라플라스 변환으로도 확인할 수 있다.

$$
\mathcal L\{u'\}
=
s\frac1s-u(0^-)
$$

이고

$$
u(0^-)=0
$$

이므로

$$
\mathcal L\{u'\}=1.
$$

이는

$$
\mathcal L\{\delta(t)\}=1
$$

과 일치한다.

---

### 4.8 주기함수의 라플라스 변환

주기가 $T$인 함수가

$$
f(t+T)=f(t)
$$

를 만족한다고 하자.

라플라스 적분을 각 주기로 나누면

$$
F(s)
=
\sum_{n=0}^\infty
\int_{nT}^{(n+1)T}
f(t)e^{-st}dt.
$$

각 구간에서

$$
t=\tau+nT
$$

라고 하면 주기성 때문에

$$
f(\tau+nT)=f(\tau)
$$

이다.

따라서

$$
F(s)
=
\left[
\int_0^T
f(\tau)e^{-s\tau}d\tau
\right]
\sum_{n=0}^{\infty}
e^{-snT}.
$$

마지막은 등비급수이다.

$$
1+e^{-sT}+e^{-2sT}+\cdots
=
\frac1{1-e^{-sT}}.
$$

따라서

$$
\boxed{
F(s)
=
\frac{
\displaystyle
\int_0^T f(t)e^{-st}dt
}{
1-e^{-sT}
}
}
$$

이다.

---

### 예제 3. 주기적인 펄스열

한 주기 $T$ 중 $DT$ 동안만 진폭 $A$이고 나머지는 0이라고 하자.

$D$는 듀티비이다.

한 주기의 적분은

$$
\int_0^{DT}
Ae^{-st}dt
=
\frac{A}{s}
(1-e^{-sDT}).
$$

따라서

$$
\boxed{
F(s)
=
\frac{
A(1-e^{-sDT})
}{
s(1-e^{-sT})
}
}
$$

이다.

---

## 5. 합성곱과 헤비사이드 전개

### 5.1 왜 합성곱이 필요한가?

저항만 있는 회로에서는

$$
v(t)=Ri(t)
$$

처럼 같은 시각의 입력과 출력이 직접 연결될 수 있다.

하지만 커패시터나 인덕터가 들어 있는 시스템은 과거를 기억한다.

예를 들어 RC 회로의 커패시터 전압은 이전에 얼마나 많은 전류가 흘렀는지에 따라 달라진다.

즉 현재 출력은 현재 입력값 하나만으로 결정되지 않는다.

과거의 입력들이 지금까지 얼마나 남아 있는지를 모두 더해야 한다.

이것이 합성곱이다.

---

### 5.2 임펄스 응답에서 합성곱이 나오는 과정

초기 상태가 0인 선형·시불변 시스템을 생각하자.

단위 임펄스

$$
\delta(t)
$$

에 대한 출력을

$$
h(t)
$$

라고 한다.

이를 **임펄스 응답(Impulse Response)**이라고 한다.

입력이 $\tau$초에 들어온

$$
\delta(t-\tau)
$$

라면 시불변성에 의해 출력은

$$
h(t-\tau)
$$

이다.

입력의 크기가

$$
x(\tau)d\tau
$$

라면 그 작은 입력이 만드는 출력은

$$
x(\tau)h(t-\tau)d\tau
$$

이다.

과거의 모든 입력을 더하면

$$
\boxed{
y(t)
=
\int_0^t
x(\tau)h(t-\tau)d\tau
}
$$

이다.

이를

$$
\boxed{
y(t)
=
(x*h)(t)
}
$$

라고 쓴다.

<div class="laplace-concept-box">
$t-\tau$는 입력이 들어온 뒤 지금까지 흐른 시간이다.<br><br>
따라서 $h(t-\tau)$는
$\tau$ 시점의 입력 효과가 현재까지 얼마나 남았는지를 나타낸다.
</div>

---

### 5.3 왜 합성곱이 라플라스 영역에서는 곱셈이 되는가?

$$
y(t)
=
\int_0^t
h(t-\tau)x(\tau)d\tau
$$

에 라플라스 변환을 적용한다.

$$
Y(s)
=
\int_0^\infty
\int_0^t
h(t-\tau)x(\tau)
d\tau\,
e^{-st}dt.
$$

$$
v=t-\tau
$$

라고 두면

$$
t=v+\tau.
$$

따라서 지수항은

$$
e^{-s(v+\tau)}
=
e^{-sv}e^{-s\tau}
$$

로 분리된다.

그래서 적분도 두 개로 분리된다.

$$
\begin{aligned}
Y(s)
&=
\left[
\int_0^\infty
h(v)e^{-sv}dv
\right]
\left[
\int_0^\infty
x(\tau)e^{-s\tau}d\tau
\right]\\
&=
H(s)X(s).
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L\{h*x\}
=
H(s)X(s)
}
$$

이다.

지수함수의

$$
e^{-s(v+\tau)}
=
e^{-sv}e^{-s\tau}
$$

라는 성질이 핵심이다.

---

### 예제 1. 합성곱으로 역변환

$$
F(s)
=
\frac1{(s+a)(s+b)}
$$

라고 하자.

이는

$$
\frac1{s+a}
\cdot
\frac1{s+b}
$$

이다.

각각의 역변환은

$$
e^{-at},
\qquad
e^{-bt}
$$

이다.

따라서

$$
f(t)
=
\int_0^t
e^{-a\tau}
e^{-b(t-\tau)}
d\tau.
$$

정리하면

$$
\begin{aligned}
f(t)
&=
e^{-bt}
\int_0^t
e^{-(a-b)\tau}d\tau\\
&=
\frac{
e^{-at}-e^{-bt}
}{
b-a
}.
\end{aligned}
$$

따라서

$$
\boxed{
\mathcal L^{-1}
\left\{
\frac1{(s+a)(s+b)}
\right\}
=
\frac{
e^{-at}-e^{-bt}
}{
b-a
}
}
$$

이다.

---

### 5.4 부분분수 전개가 필요한 이유

실제로 역변환에서는 합성곱보다 부분분수 전개가 더 빠른 경우가 많다.

예를 들어

$$
F(s)
=
\frac{s+3}{(s+1)(s+2)}
$$

를 그대로 변환표에서 찾기는 어렵다.

그래서

$$
\frac{A}{s+1}
+
\frac{B}{s+2}
$$

형태로 쪼갠다.

왜 이렇게 쪼갤까?

각 항은 바로

$$
e^{-t},
\qquad
e^{-2t}
$$

에 대응하기 때문이다.

즉 부분분수 전개는 단순히 분수를 예쁘게 만드는 계산이 아니라

> 복잡한 응답을 서로 다른 지수 모드로 분리하는 과정

이다.

---

### 5.5 헤비사이드 가림법

$$
F(s)
=
\frac{s+3}{(s+1)(s+2)}
$$

라고 하자.

$$
F(s)
=
\frac{A}{s+1}
+
\frac{B}{s+2}.
$$

$A$는

$$
A
=
\left.
(s+1)F(s)
\right|_{s=-1}.
$$

따라서

$$
A
=
\left.
\frac{s+3}{s+2}
\right|_{s=-1}
=
2.
$$

마찬가지로

$$
B
=
\left.
\frac{s+3}{s+1}
\right|_{s=-2}
=
-1.
$$

따라서

$$
\boxed{
F(s)
=
\frac2{s+1}
-
\frac1{s+2}
}
$$

이고

$$
\boxed{
f(t)
=
2e^{-t}-e^{-2t}
}
$$

이다.

---

### 5.6 일반적인 단순극점의 헤비사이드 공식

$$
F(s)
=
\frac{N(s)}{D(s)}
$$

이고 $D(s)$가 서로 다른 단순근

$$
p_1,p_2,\ldots
$$

를 가진다면

$$
F(s)
=
\sum_k
\frac{A_k}{s-p_k}.
$$

계수는

$$
\boxed{
A_k
=
\lim_{s\to p_k}
(s-p_k)F(s)
}
$$

이다.

또는

$$
\boxed{
A_k
=
\frac{N(p_k)}{D'(p_k)}
}
$$

로 구할 수 있다.

---

### 5.7 반복극점은 왜 항을 여러 개 써야 하는가?

다음 함수를 보자.

$$
F(s)
=
\frac1{s(s+1)^2}.
$$

$s=-1$은 2중극점이다.

따라서

$$
F(s)
=
\frac{A}{s}
+
\frac{B}{s+1}
+
\frac{C}{(s+1)^2}
$$

처럼 모든 차수의 항을 포함해야 한다.

계산하면

$$
A=1,
\qquad
B=-1,
\qquad
C=-1.
$$

따라서

$$
\boxed{
F(s)
=
\frac1s
-
\frac1{s+1}
-
\frac1{(s+1)^2}
}
$$

이다.

역변환하면

$$
\boxed{
f(t)
=
1-e^{-t}-te^{-t}
}
$$

이다.

$(s+1)^{-2}$가

$$
te^{-t}
$$

와 연결된다.

즉 반복극점은 시간영역에서

$$
t,\quad t^2,\quad\cdots
$$

같은 다항식 인자를 만든다.

---

### 예제 2. 복소극점이 있는 역변환

$$
F(s)
=
\frac{s+4}{s^2+4s+8}.
$$

분모를 완전제곱으로 만든다.

$$
s^2+4s+8
=
(s+2)^2+4.
$$

분자는

$$
s+4
=
(s+2)+2.
$$

따라서

$$
F(s)
=
\frac{s+2}{(s+2)^2+2^2}
+
\frac2{(s+2)^2+2^2}.
$$

따라서

$$
\boxed{
f(t)
=
e^{-2t}\cos2t
+
e^{-2t}\sin2t
}
$$

이다.

극점은

$$
-2\pm2j
$$

이다.

실수부 $-2$는 감쇠율이고 허수부 $2$는 진동 주파수이다.

---

### 5.8 지연과 부분분수가 함께 있는 경우

$$
F(s)
=
e^{-2s}
\frac1{s(s+1)}
$$

이라고 하자.

먼저 지연항을 제외한다.

$$
\frac1{s(s+1)}
=
\frac1s-\frac1{s+1}.
$$

따라서 기본 시간함수는

$$
g(t)
=
1-e^{-t}.
$$

이제 2초 지연시킨다.

$$
\boxed{
f(t)
=
u(t-2)
\left[
1-e^{-(t-2)}
\right]
}
$$

이다.

지연된 함수의 내부 시간도

$$
t-2
$$

로 바뀌어야 한다는 점에 주의해야 한다.

---

## 6. 라플라스 변환의 응용

### 6.1 미분방정식 초기값 문제

다음을 풀어보자.

$$
y'+2y=3,
\qquad
y(0)=1.
$$

#### Step 1. 라플라스 변환

$$
sY-1+2Y
=
\frac3s.
$$

따라서

$$
(s+2)Y
=
1+\frac3s.
$$

$$
Y
=
\frac{s+3}{s(s+2)}.
$$

#### Step 2. 부분분수 전개

$$
Y
=
\frac{A}{s}
+
\frac{B}{s+2}.
$$

$s=0$이면

$$
A=\frac32.
$$

$s=-2$이면

$$
B=-\frac12.
$$

따라서

$$
Y
=
\frac{3}{2s}
-
\frac1{2(s+2)}.
$$

#### Step 3. 역변환

$$
\boxed{
y(t)
=
\frac32
-
\frac12e^{-2t}
}
$$

이다.

$t\to\infty$이면

$$
y(t)\to\frac32.
$$

원래 미분방정식의 정상상태에서는 $y'=0$이므로

$$
2y=3
$$

이고

$$
y=\frac32
$$

가 되어 일치한다.

---

### 6.2 전달함수는 무엇인가?

초기 상태가 0인 선형 시불변 시스템에서

$$
Y(s)
=
H(s)X(s)
$$

라고 할 수 있다.

여기서

$$
\boxed{
H(s)
=
\frac{Y(s)}{X(s)}
}
$$

를 **전달함수(Transfer Function)**라고 한다.

전달함수는 특정 입력 자체가 아니다.

시스템이 입력을 출력으로 어떻게 바꾸는지를 나타내는 함수이다.

입력이 단위 임펄스이면

$$
X(s)=1
$$

이므로

$$
Y(s)=H(s)
$$

이다.

따라서

$$
\boxed{
H(s)
=
\mathcal L\{h(t)\}
}
$$

이다.

즉

- $h(t)$: 시간영역의 임펄스 응답
- $H(s)$: $s$영역의 전달함수

는 같은 시스템을 서로 다른 영역에서 표현한 것이다.

---

### 6.3 RC 회로의 미분방정식

직렬 RC 회로에서 커패시터 전압을 출력으로 잡자.

Kirchhoff 전압법칙에 의해

$$
v_{\mathrm{in}}
=
v_R+v_C.
$$

저항에서는

$$
v_R=Ri
$$

이고 커패시터에서는

$$
i=C\frac{dv_C}{dt}.
$$

따라서

$$
v_R
=
RC\frac{dv_C}{dt}.
$$

결국

$$
\boxed{
RC\frac{dv_C}{dt}
+
v_C
=
v_{\mathrm{in}}
}
$$

이다.

여기서

$$
\tau=RC
$$

를 시정수라고 하면

$$
\boxed{
\tau v_C'+v_C=v_{\mathrm{in}}
}
$$

이다.

---

### 6.4 초기전압이 있는 RC 회로

초기 커패시터 전압이

$$
v_C(0^-)=V_0
$$

이고 $t=0$부터

$$
v_{\mathrm{in}}(t)=V_su(t)
$$

를 인가한다고 하자.

라플라스 변환하면

$$
\tau
[sV_C(s)-V_0]
+
V_C(s)
=
\frac{V_s}{s}.
$$

따라서

$$
(\tau s+1)V_C
=
\frac{V_s}{s}
+
\tau V_0.
$$

즉

$$
V_C(s)
=
\frac{V_s}{s(\tau s+1)}
+
\frac{\tau V_0}{\tau s+1}.
$$

첫 항은 입력 때문에 생긴 응답이고 두 번째 항은 초기 저장 에너지 때문에 생긴 응답이다.

역변환하면

$$
\boxed{
v_C(t)
=
V_s
+
(V_0-V_s)e^{-t/\tau}
}
$$

이다.

---

### 예제 1. 실제 RC 회로

$$
R=1\,\mathrm{k\Omega},
\qquad
C=100\,\mu\mathrm F
$$

라고 하자.

시정수는

$$
\tau
=
RC
=
1000
\times
100\times10^{-6}
=
0.1\,\mathrm s.
$$

초기전압이

$$
V_0=2\,\mathrm V
$$

이고 입력전압이

$$
V_s=5\,\mathrm V
$$

이면

$$
\boxed{
v_C(t)
=
5-3e^{-10t}
}
$$

이다.

$t=0$이면

$$
v_C(0)=2\,\mathrm V
$$

이고

$t\to\infty$이면

$$
v_C(t)\to5\,\mathrm V.
$$

$t=\tau=0.1\,\mathrm s$에서는

$$
v_C(0.1)
=
5-3e^{-1}
\approx3.90\,\mathrm V.
$$

---

### 6.5 왜 시정수 한 번마다 $e^{-1}$이 나오는가?

RC 응답에서 최종값과 현재값의 차이를 보자.

$$
v_C(t)-V_s
=
(V_0-V_s)e^{-t/\tau}.
$$

$t=\tau$이면

$$
e^{-t/\tau}
=
e^{-1}
\approx0.368.
$$

따라서 최종값과의 차이가 처음의 약

$$
36.8\%
$$

로 줄어든다.

$t=5\tau$에서는

$$
e^{-5}\approx0.0067
$$

이므로 사실상 정상상태에 매우 가까워진다.

---

### 6.6 RC 회로에 펄스를 인가하면?

초기전압은 0이고

$$
v_{\mathrm{in}}(t)
=
V_s[u(t)-u(t-T)]
$$

라고 하자.

입력의 변환은

$$
V_{\mathrm{in}}(s)
=
\frac{V_s}{s}
(1-e^{-sT}).
$$

RC 전달함수는

$$
H(s)
=
\frac1{\tau s+1}.
$$

따라서

$$
V_C(s)
=
\frac{V_s}{s(\tau s+1)}
(1-e^{-sT}).
$$

시간영역에서는

$$
\boxed{
v_C(t)
=
V_s(1-e^{-t/\tau})u(t)
-
V_s
\left[
1-e^{-(t-T)/\tau}
\right]
u(t-T)
}
$$

이다.

구간별로 쓰면

$$
v_C(t)
=
\begin{cases}
V_s(1-e^{-t/\tau}),
&
0\le t<T,\\[6pt]
V_s(1-e^{-T/\tau})
e^{-(t-T)/\tau},
&
t\ge T.
\end{cases}
$$

첫 구간에서는 충전하고, 입력이 꺼진 뒤에는 그 순간 저장되어 있던 전압을 초기값으로 방전한다.

입력이 0이 되었다고 커패시터 전압도 즉시 0이 되는 것은 아니다.

이것이 시스템의 **기억(memory)**이다.

---

### 6.7 $s$영역에서 저항·인덕터·커패시터

#### 저항

$$
v_R(t)=Ri(t)
$$

이므로

$$
\boxed{
V_R(s)=RI(s)
}
$$

이다.

#### 인덕터

$$
v_L
=
L\frac{di_L}{dt}
$$

이므로

$$
V_L
=
L[sI_L-i_L(0^-)].
$$

따라서

$$
\boxed{
V_L
=
sLI_L
-
Li_L(0^-)
}
$$

이다.

초기전류가 0이면

$$
\frac{V_L}{I_L}
=
sL.
$$

#### 커패시터

$$
i_C
=
C\frac{dv_C}{dt}
$$

이므로

$$
I_C
=
C[sV_C-v_C(0^-)].
$$

따라서

$$
\boxed{
I_C
=
sCV_C
-
Cv_C(0^-)
}
$$

이다.

초기전압이 0이면

$$
\frac{V_C}{I_C}
=
\frac1{sC}.
$$

따라서 영상태에서는

| 소자 | $s$영역 임피던스 |
|---|---|
| 저항 | $R$ |
| 인덕터 | $sL$ |
| 커패시터 | $\displaystyle \frac1{sC}$ |

이다.

하지만 초기 에너지가 존재하면 초기조건 항을 별도로 포함해야 한다.

---

### 6.8 RLC 회로

직렬 RLC 회로에서 커패시터 전압을 출력으로 잡으면

$$
LCv_C''
+
RCv_C'
+
v_C
=
v_{\mathrm{in}}
$$

이다.

초기상태가 0이면

$$
(LCs^2+RCs+1)V_C
=
V_{\mathrm{in}}.
$$

따라서 전달함수는

$$
\boxed{
H_C(s)
=
\frac{V_C(s)}{V_{\mathrm{in}}(s)}
=
\frac1{LCs^2+RCs+1}
}
$$

이다.

---

### 예제 2. RLC 회로의 극점

$$
L=1\,\mathrm H,
\qquad
R=2\,\Omega,
\qquad
C=0.2\,\mathrm F
$$

라고 하자.

그러면

$$
LC=0.2,
\qquad
RC=0.4.
$$

따라서

$$
H_C(s)
=
\frac1{0.2s^2+0.4s+1}
$$

이다.

분자와 분모에 5를 곱하면

$$
H_C(s)
=
\frac5{s^2+2s+5}.
$$

완전제곱하면

$$
\boxed{
H_C(s)
=
\frac5{(s+1)^2+4}
}
$$

이다.

극점은

$$
\boxed{
s=-1\pm2j
}
$$

이다.

따라서

- 실수부 $-1$ → 감쇠
- 허수부 $\pm2$ → 진동

을 의미한다.

임펄스 응답은

$$
\boxed{
h_C(t)
=
\frac52e^{-t}\sin2t\,u(t)
}
$$

이다.

---

### 6.9 RLC 회로에 계단 입력을 가하면?

초기상태가 0이고 입력이

$$
v_{\mathrm{in}}(t)=u(t)
$$

이면

$$
V_{\mathrm{in}}(s)
=
\frac1s.
$$

따라서

$$
V_C(s)
=
\frac5{
s(s^2+2s+5)
}.
$$

부분분수로 정리하면

$$
V_C(s)
=
\frac1s
-
\frac{s+2}{(s+1)^2+4}.
$$

분자를

$$
s+2=(s+1)+1
$$

로 나누면

$$
V_C(s)
=
\frac1s
-
\frac{s+1}{(s+1)^2+4}
-
\frac1{(s+1)^2+4}.
$$

마지막 항은

$$
\frac12
\frac2{(s+1)^2+4}
$$

이다.

따라서

$$
\boxed{
v_C(t)
=
1
-
e^{-t}\cos2t
-
\frac12e^{-t}\sin2t
}
$$

이다.

또는

$$
\boxed{
v_C(t)
=
1
-
e^{-t}
\left(
\cos2t+\frac12\sin2t
\right)
}
$$

이다.

시간이 충분히 지나면 감쇠항이 사라져

$$
v_C(t)\to1
$$

이다.

---

### 6.10 극점은 왜 중요한가?

전달함수

$$
H(s)
=
\frac{N(s)}{D(s)}
$$

에서 분모가 0이 되는 점을 **극점(Pole)**이라고 한다.

$$
D(p)=0
$$

이다.

극점 $p$에 대응하는 시간영역 항은 대체로

$$
e^{pt}
$$

형태이다.

$p=\sigma+j\omega$이면

$$
e^{pt}
=
e^{\sigma t}
[
\cos\omega t
+
j\sin\omega t
].
$$

따라서

- $\operatorname{Re}p<0$: 감쇠
- $\operatorname{Re}p=0$: 감쇠하지 않음
- $\operatorname{Re}p>0$: 성장
- $\operatorname{Im}p\neq0$: 진동

이다.

즉 극점의 위치만 보고도 시스템의 시간응답 특성을 상당 부분 예측할 수 있다.

---

### 6.11 영점은 무엇인가?

전달함수의 분자가 0이 되는 점을

**영점(Zero)**

이라고 한다.

예를 들어 RC 회로에서 저항 전압을 출력으로 잡으면

$$
H_R(s)
=
\frac{RCs}{1+RCs}.
$$

분자는

$$
RCs
$$

이므로 원점

$$
s=0
$$

에 영점이 있다.

따라서

$$
H_R(0)=0.
$$

$s=0$은 DC와 연결된다.

즉 일정한 DC 입력이 충분히 오래 지속되면 저항 전압은 0이 된다.

실제로 커패시터가 완전히 충전된 후에는 전류가 흐르지 않으므로

$$
v_R=Ri=0
$$

이다.

---

### 6.12 왜 주파수 응답에서는 $s=j\omega$를 사용하는가?

앞에서

$$
s=\sigma+j\omega
$$

라고 했다.

정상상태 정현파는 시간이 지나도 진폭이 자체적으로 증가하거나 감소하지 않는다.

따라서

$$
\sigma=0
$$

인 경우이다.

즉

$$
\boxed{
s=j\omega
}
$$

이다.

복소지수 입력을

$$
x(t)=e^{j\omega t}
$$

라고 하면 선형 시불변 시스템의 정상상태 출력은

$$
\boxed{
y(t)
=
H(j\omega)e^{j\omega t}
}
$$

이다.

$H(j\omega)$는 일반적으로 복소수이므로

$$
H(j\omega)
=
|H(j\omega)|
e^{j\angle H(j\omega)}
$$

라고 쓸 수 있다.

따라서 실수 코사인 입력

$$
x(t)
=
A\cos\omega t
$$

에 대한 정상상태 출력은

$$
\boxed{
y_{\mathrm{ss}}(t)
=
A|H(j\omega)|
\cos[
\omega t+\angle H(j\omega)
]
}
$$

이다.

즉 시스템은

- 진폭을 $\vert H(j\omega) \vert$배
- 위상을 $\angle H(j\omega)$만큼

변화시킨다.

이 지점에서 라플라스 변환과 푸리에 해석이 연결되기 시작한다.

---

### 6.13 같은 시스템을 세 가지 방법으로 보는 법

RC 회로를 예로 들면 다음 세 식이 있다.

#### 미분방정식

$$
RCv_C'+v_C=v_{\mathrm{in}}
$$

#### 임펄스 응답

$$
h(t)
=
\frac1{RC}
e^{-t/(RC)}
u(t)
$$

#### 전달함수

$$
H(s)
=
\frac1{1+RCs}
$$

세 식은 서로 다른 회로를 의미하는 것이 아니다.

같은 RC 회로를 서로 다른 관점에서 표현한 것이다.

| 표현 | 무엇을 보여 주는가 |
|---|---|
| 미분방정식 | 순간적인 변화율과 물리 법칙 |
| 임펄스 응답 | 과거 입력이 현재까지 남긴 영향 |
| 전달함수 | 입력과 출력의 $s$영역 관계 |

---

## 문제 풀이 순서

라플라스 변환 문제를 풀 때는 다음 순서를 추천한다.

### Step 1. 입력과 출력 확인

무엇이 입력이고 무엇을 구해야 하는지 확인한다.

### Step 2. 초기조건 확인

$$
y(0^-),\quad
y'(0^-)
$$

등이 있는지 확인한다.

### Step 3. 시간영역 방정식 작성

미분방정식을 먼저 정확하게 세운다.

### Step 4. 입력을 적절하게 표현

계단, 펄스, 임펄스, 구간별 함수인지 확인한다.

### Step 5. 라플라스 변환

미분항에서 초기조건을 빠뜨리지 않는다.

$$
y'
\rightarrow
sY-y(0^-)
$$

$$
y''
\rightarrow
s^2Y-sy(0^-)-y'(0^-)
$$

### Step 6. $Y(s)$ 정리

대수적으로 출력 변환을 구한다.

### Step 7. 역변환 가능한 형태로 변형

필요하면

- 부분분수
- 완전제곱
- 시간지연
- 합성곱

을 사용한다.

### Step 8. 역라플라스 변환

시간영역의 해를 구한다.

### Step 9. 검산

반드시 다음을 확인한다.

- 초기값
- 최종값
- 원래 미분방정식
- 극점
- 단위
- 물리적인 의미

---

## 종합 예제 1. 지연된 입력이 있는 초기값 문제

다음을 풀어보자.

$$
y'+2y=u(t-1),
\qquad
y(0^-)=1.
$$

### Step 1. 라플라스 변환

$$
sY-1+2Y
=
\frac{e^{-s}}s.
$$

따라서

$$
(s+2)Y
=
1+
\frac{e^{-s}}s.
$$

$$
Y
=
\frac1{s+2}
+
e^{-s}
\frac1{s(s+2)}.
$$

### Step 2. 지연되지 않은 부분 분해

$$
\frac1{s(s+2)}
=
\frac12
\left(
\frac1s-\frac1{s+2}
\right).
$$

따라서 기본 함수는

$$
\frac12
(1-e^{-2t}).
$$

### Step 3. 1초 지연

$$
e^{-s}
\frac1{s(s+2)}
$$

이므로

$$
\frac12
u(t-1)
\left[
1-e^{-2(t-1)}
\right].
$$

따라서

$$
\boxed{
y(t)
=
e^{-2t}
+
\frac12u(t-1)
\left[
1-e^{-2(t-1)}
\right]
}
$$

이다.

첫 항은 처음부터 존재했던 초기상태의 영향이고, 두 번째 항은 $t=1$에서 켜진 입력의 영향이다.

---

## 종합 예제 2. 임펄스 입력

$$
y'+2y
=
3\delta(t-1),
\qquad
y(0^-)=0
$$

을 풀어보자.

라플라스 변환하면

$$
sY+2Y
=
3e^{-s}.
$$

따라서

$$
Y
=
\frac{3e^{-s}}{s+2}.
$$

기본 함수는

$$
3e^{-2t}
$$

이고 1초 지연되어 있으므로

$$
\boxed{
y(t)
=
3u(t-1)e^{-2(t-1)}
}
$$

이다.

$t=1$ 직전에는

$$
y(1^-)=0
$$

이고 직후에는

$$
y(1^+)=3
$$

이다.

실제로 원래 방정식을 $t=1$ 주변에서 아주 짧은 구간에 대해 적분하면

$$
\int_{1^-}^{1^+}y'dt
+
2\int_{1^-}^{1^+}y\,dt
=
3.
$$

구간이 무한히 작아지면 두 번째 적분은 0으로 가므로

$$
y(1^+)-y(1^-)=3
$$

이다.

임펄스가 상태를 순간적으로 변화시킨 것이다.

---

## 종합 예제 3. 최종값 정리를 사용해도 되는가?

$$
F(s)
=
\frac1{s(s^2+1)}
$$

을 생각하자.

형식적으로

$$
\lim_{s\to0}sF(s)
=
1
$$

이다.

하지만

$$
sF(s)
=
\frac1{s^2+1}
$$

의 극점은

$$
s=\pm j
$$

이다.

허수축 위에 극점이 있으므로 최종값 정리의 조건을 만족하지 않는다.

실제로

$$
F(s)
=
\frac1s
-
\frac{s}{s^2+1}
$$

이므로

$$
\boxed{
f(t)=1-\cos t
}
$$

이다.

이 함수는 계속 진동하므로 최종값이 존재하지 않는다.

따라서

> 최종값 정리는 단순히 $s\to0$을 대입하는 공식이 아니라,
> 시스템이 실제로 정상상태에 수렴하는지 확인한 뒤 사용하는 정리이다.

---

## 핵심 공식 정리

### 라플라스 변환

$$
\boxed{
F(s)
=
\mathcal L\{f(t)\}
=
\int_0^\infty
f(t)e^{-st}dt
}
$$

$$
\boxed{
s=\sigma+j\omega
}
$$

---

### 도함수

$$
\boxed{
\mathcal L\{f'\}
=
sF-f(0^-)
}
$$

$$
\boxed{
\mathcal L\{f''\}
=
s^2F
-
sf(0^-)
-
f'(0^-)
}
$$

---

### $s$ 이동

$$
\boxed{
e^{at}f(t)
\longleftrightarrow
F(s-a)
}
$$

---

### 시간 지연

$$
\boxed{
u(t-a)f(t-a)
\longleftrightarrow
e^{-as}F(s)
}
$$

---

### 시간에서 $t$를 곱하기

$$
\boxed{
tf(t)
\longleftrightarrow
-\frac{dF}{ds}
}
$$

---

### 시간 적분

$$
\boxed{
\int_0^t
f(\tau)d\tau
\longleftrightarrow
\frac{F(s)}s
}
$$

---

### 합성곱

$$
\boxed{
(f*g)(t)
=
\int_0^t
f(\tau)g(t-\tau)d\tau
}
$$

$$
\boxed{
\mathcal L\{f*g\}
=
F(s)G(s)
}
$$

---

### 단위계단

$$
\boxed{
u(t-a)
\longleftrightarrow
\frac{e^{-as}}s
}
$$

---

### 임펄스

$$
\boxed{
\delta(t-a)
\longleftrightarrow
e^{-as}
}
$$

---

### 주기함수

$$
\boxed{
F(s)
=
\frac{
\displaystyle\int_0^T
f(t)e^{-st}dt
}{
1-e^{-sT}
}
}
$$

---

## Summary

라플라스 변환의 정의는 단순히 외워야 할 임의의 공식이 아니다.

먼저 우리는 미분방정식을 더 간단한 대수방정식으로 바꾸고 싶었다.

미분했을 때 형태가 유지되는 함수를 찾으면

$$
e^{st}
$$

가 나온다.

그리고 성장·감쇠와 진동을 동시에 표현하기 위해

$$
s=\sigma+j\omega
$$

라는 복소수를 사용한다.

임의의 함수를 변환하면서 미분을 $s$의 곱셈으로 바꾸려면 가중함수 $K_s(t)$가

$$
K_s'=-sK_s
$$

를 만족해야 한다.

그 결과

$$
K_s(t)=e^{-st}
$$

가 자연스럽게 나온다.

따라서

$$
\boxed{
F(s)
=
\int_0^\infty
f(t)e^{-st}dt
}
$$

라는 라플라스 변환의 정의가 만들어진다.

라플라스 변환에서는

$$
\frac{d}{dt}
$$

가

$$
s
$$

의 곱셈으로 바뀌면서 초기조건이 경계항으로 함께 남는다.

그래서 초기값을 가진 미분방정식, 계단과 펄스 입력, 임펄스, 회로의 과도응답을 한 가지 방법으로 다룰 수 있다.

또한

$$
s=\sigma+j\omega
$$

에서 극점의 실수부는 감쇠와 성장, 허수부는 진동을 나타낸다.

따라서 라플라스 변환은 단순히 미분방정식을 풀기 위한 계산법을 넘어

- 시스템의 자연응답
- 초기상태
- 과도응답
- 임펄스 응답
- 전달함수
- 극점과 영점
- 안정성
- 주파수 응답

을 하나의 $s$평면에서 연결해서 볼 수 있게 해 준다.

다음 단계에서는 이 아이디어가 **푸리에 급수와 푸리에 변환에서 주파수 성분을 분석하는 방법으로 어떻게 이어지는지** 연결해서 살펴볼 수 있다.