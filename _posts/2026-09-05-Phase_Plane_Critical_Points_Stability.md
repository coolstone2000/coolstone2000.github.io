---
layout: single
title: "Phase Plane, Critical Points and Stability"
categories: Math
tags: Math
toc: true
author_profile: false
comments: true
---

# 위상평면과 임계점 및 안정성

이번 장에서는 연립미분방정식의 해를 단순히 $x_1(t)$, $x_2(t)$라는 두 함수로 보는 데서 한 걸음 더 나아가,

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
x_1(t)\\
x_2(t)
\end{bmatrix}
}
$$

를 하나의 움직이는 점으로 생각한다.

즉 시간 $t$가 변할 때 점

$$
(x_1(t),x_2(t))
$$

가 평면 위에서 어떤 경로를 그리는지를 관찰한다.

이 평면을 **위상평면(phase plane)** 이라고 하고, 그 위에서 나타나는 곡선을 **위상궤적(phase trajectory)** 이라고 한다.

---

## 이 장에서 배우는 핵심

이번 장의 핵심 흐름은 다음과 같다.

$$
\boxed{
\text{연립미분방정식}
\longrightarrow
\text{위상평면}
\longrightarrow
\text{임계점}
\longrightarrow
\text{안정성}
}
$$

특히 두 종류의 시스템을 다룬다.

1. **제차(동차) 선형연립미분방정식의 위상평면**
2. **제차(동차) 비선형연립미분방정식의 위상평면**

선형계에서는 주로 **고유값과 고유벡터**가 위상평면의 모양을 결정하고,

비선형계에서는 임계점 근처에서 **선형화(linearization)** 를 이용해 시스템을 분석한다.

---

{% include phase-plane-stability-explorer.html %}

---

# 1. 위상평면이란?

2차 연립미분방정식

$$
\begin{cases}
x_1' = f_1(x_1,x_2)\\
x_2' = f_2(x_1,x_2)
\end{cases}
$$

을 생각하자.

시간 $t$에 따라 $x_1(t)$와 $x_2(t)$가 변하면, 위상평면에서는

$$
\bigl(x_1(t),x_2(t)\bigr)
$$

라는 점 하나가 움직인다.

예를 들어

$$
x_1(t)=e^{-t},
\qquad
x_2(t)=2e^{-t}
$$

이면

$$
x_2=2x_1
$$

이므로 위상평면에서는 직선 위를 따라 원점으로 이동한다.

---

## 1.1 시간응답과 위상평면의 차이

같은 해라도 두 가지 방식으로 볼 수 있다.

### 시간응답

가로축을 $t$로 두고

$$
x_1(t),\qquad x_2(t)
$$

를 각각 그린다.

즉

$$
t \longrightarrow x_1(t),x_2(t)
$$

를 보는 방식이다.

### 위상평면

시간축을 직접 표시하지 않고

$$
x_1(t)
$$

를 가로축,

$$
x_2(t)
$$

를 세로축으로 둔다.

즉

$$
x_1(t)\longrightarrow x_2(t)
$$

의 관계를 보는 방식이다.

따라서

$$
\boxed{
\text{시간응답과 위상평면은 같은 해를 서로 다른 관점에서 보는 것이다.}
}
$$

---

# 2. 임계점

연립계

$$
\begin{cases}
x_1' = f_1(x_1,x_2)\\
x_2' = f_2(x_1,x_2)
\end{cases}
$$

에서 어떤 점 $(x_1^*,x_2^*)$가

$$
f_1(x_1^*,x_2^*)=0,
\qquad
f_2(x_1^*,x_2^*)=0
$$

을 만족하면 그 점을 **임계점(critical point)** 또는 **평형점(equilibrium point)** 이라고 한다.

그 점에서는

$$
x_1'=0,\qquad x_2'=0
$$

이므로 상태가 더 이상 움직이지 않는다.

---

## 2.1 선형 동차계의 임계점

선형계

$$
\mathbf{x}'=A\mathbf{x}
$$

에서

$$
\mathbf{x}=\mathbf{0}
$$

을 대입하면 항상

$$
\mathbf{x}'=A\mathbf{0}=\mathbf{0}
$$

이므로 원점은 항상 임계점이다.

행렬 $A$가 가역이면 원점이 유일한 임계점이다.

---

# 3. 제차(동차) 선형연립미분방정식의 위상평면

가장 기본적인 형태는

$$
\boxed{
\mathbf{x}'=A\mathbf{x}
}
$$

이다.

2차원에서는

$$
A=
\begin{bmatrix}
a&b\\
c&d
\end{bmatrix}
$$

이므로

$$
\begin{cases}
x_1'=ax_1+bx_2\\
x_2'=cx_1+dx_2
\end{cases}
$$

가 된다.

이 시스템의 위상평면 모양은 대부분 행렬 $A$의 **고유값**으로 결정된다.

---

# 4. 고유값과 위상평면의 관계

고유값과 고유벡터가

$$
A\mathbf{v}=\lambda\mathbf{v}
$$

를 만족한다고 하자.

그러면

$$
\mathbf{x}(t)=\mathbf{v}e^{\lambda t}
$$

가 하나의 해가 된다.

즉 고유벡터 방향에서는 상태가 방향을 바꾸지 않고

$$
e^{\lambda t}
$$

만큼 증가하거나 감소한다.

따라서

- 고유벡터: 시스템이 자연스럽게 움직이는 방향
- 고유값: 그 방향에서의 성장 또는 감쇠 속도

라고 해석할 수 있다.

---

# 5. 실수 고유값에 따른 분류

## 5.1 두 고유값이 모두 음수

예를 들어

$$
\lambda_1=-1,
\qquad
\lambda_2=-3
$$

이라고 하자.

두 모드 모두

$$
e^{-t},
\qquad
e^{-3t}
$$

처럼 0으로 감쇠한다.

따라서 모든 궤적은 시간이 지날수록 원점으로 접근한다.

이때 원점은 **안정 마디(stable node)** 이다.

$$
\boxed{
\lambda_1<0,\ \lambda_2<0
\quad\Longrightarrow\quad
\text{안정 마디}
}
$$

---

## 5.2 두 고유값이 모두 양수

예를 들어

$$
\lambda_1=1,
\qquad
\lambda_2=4
$$

이면 두 모드 모두 시간이 지날수록 증가한다.

따라서 대부분의 궤적이 원점에서 멀어진다.

이를 **불안정 마디(unstable node)** 라고 한다.

$$
\boxed{
\lambda_1>0,\ \lambda_2>0
\quad\Longrightarrow\quad
\text{불안정 마디}
}
$$

---

## 5.3 두 고유값의 부호가 서로 다름

예를 들어

$$
\lambda_1=2,
\qquad
\lambda_2=-1
$$

이라고 하자.

한 방향에서는 $e^{2t}$ 때문에 성장하고, 다른 방향에서는 $e^{-t}$ 때문에 감쇠한다.

따라서 어떤 방향에서는 원점으로 들어가지만 다른 방향에서는 원점에서 멀어진다.

이를 **안장점(saddle point)** 이라고 한다.

$$
\boxed{
\lambda_1\lambda_2<0
\quad\Longrightarrow\quad
\text{안장점}
}
$$

안장점은 항상 불안정하다.

---

# 6. 복소 고유값에 따른 분류

고유값이

$$
\lambda=\alpha\pm j\beta
$$

꼴이라고 하자.

오일러 공식

$$
e^{j\beta t}
=
\cos\beta t+j\sin\beta t
$$

때문에 해에는 회전 또는 진동 성분이 나타난다.

또한 $e^{\alpha t}$가 전체 진폭을 결정한다.

---

## 6.1 실수부가 음수

$$
\alpha<0
$$

이면 진동하면서 크기가 점점 줄어든다.

위상평면에서는 궤적이 나선형으로 원점에 들어간다.

이를 **안정 나선(stable spiral)** 이라고 한다.

---

## 6.2 실수부가 양수

$$
\alpha>0
$$

이면 진동하면서 크기가 점점 커진다.

위상평면에서는 나선형으로 원점에서 멀어진다.

이를 **불안정 나선(unstable spiral)** 이라고 한다.

---

## 6.3 실수부가 0

$$
\lambda=\pm j\beta
$$

처럼 순허수 고유값만 존재하면 진폭이 줄지도 커지지도 않는다.

대표적으로

$$
\begin{cases}
x_1'=-x_2\\
x_2'=x_1
\end{cases}
$$

를 생각하자.

행렬은

$$
A=
\begin{bmatrix}
0&-1\\
1&0
\end{bmatrix}
$$

이고 고유값은

$$
\lambda=\pm j
$$

이다.

위상평면에서는 원점 주위를 계속 회전한다.

이를 **중심(center)** 이라고 한다.

---

# 7. 선형계 분류 한눈에 보기

| 고유값 | 위상평면 형태 | 안정성 |
|---|---|---|
| $\lambda_1<0,\lambda_2<0$ | 안정 마디 | 점근 안정 |
| $\lambda_1>0,\lambda_2>0$ | 불안정 마디 | 불안정 |
| $\lambda_1\lambda_2<0$ | 안장점 | 불안정 |
| $\alpha\pm j\beta,\ \alpha<0$ | 안정 나선 | 점근 안정 |
| $\alpha\pm j\beta,\ \alpha>0$ | 불안정 나선 | 불안정 |
| $\pm j\beta$ | 중심 | 중립 안정 |

---

# 8. 예제 1: 안정 마디

$$
\begin{cases}
x_1'=-x_1\\
x_2'=-2x_2
\end{cases}
$$

행렬은

$$
A=
\begin{bmatrix}
-1&0\\
0&-2
\end{bmatrix}
$$

이고 고유값은

$$
\lambda_1=-1,\qquad \lambda_2=-2
$$

이다.

따라서

$$
x_1=C_1e^{-t},
\qquad
x_2=C_2e^{-2t}
$$

이고 모든 해는 원점으로 수렴한다.

즉 원점은 안정 마디이다.

---

# 9. 예제 2: 안장점

$$
\begin{cases}
x_1'=2x_1\\
x_2'=-x_2
\end{cases}
$$

고유값은

$$
\lambda_1=2,\qquad \lambda_2=-1
$$

이다.

$x_2$ 방향으로는 원점에 접근하지만 $x_1$ 방향으로는 원점에서 멀어진다.

따라서 원점은 안장점이다.

---

# 10. 예제 3: 안정 나선

$$
\mathbf{x}'
=
\begin{bmatrix}
-1&-2\\
2&-1
\end{bmatrix}
\mathbf{x}
$$

특성방정식을 풀면

$$
\lambda=-1\pm2j
$$

를 얻는다.

실수부가 음수이므로 진동하면서 감쇠한다.

따라서 위상평면에서는 궤적이 원점을 향해 나선형으로 들어간다.

---

# 11. 안정성이란?

임계점 근처에서 시작한 해가 시간이 지나도 임계점 근처에 머무는지를 보는 개념이다.

## 11.1 안정

초기값을 임계점에 충분히 가깝게 잡으면 해가 계속 임계점 근처에 머문다.

## 11.2 점근 안정

안정할 뿐만 아니라

$$
\lim_{t\to\infty}\mathbf{x}(t)=\mathbf{0}
$$

가 성립한다.

## 11.3 불안정

임계점에 아주 가깝게 출발해도 시간이 지나면서 멀어질 수 있다.

---

# 12. 제차(동차) 비선형연립미분방정식의 위상평면

이제

$$
\begin{cases}
x_1'=f_1(x_1,x_2)\\
x_2'=f_2(x_1,x_2)
\end{cases}
$$

처럼 비선형 함수가 들어가는 시스템을 생각하자.

비선형계는 일반적으로 선형계처럼 고유값만으로 전체 해를 직접 구하기 어렵다.

그래서 먼저 임계점을 찾고 그 근처에서 시스템을 선형화한다.

---

# 13. 비선형계의 임계점 찾기

다음 비선형계가 있다고 하자.

$$
\begin{cases}
x'=f(x,y)\\
y'=g(x,y)
\end{cases}
$$

임계점은

$$
f(x,y)=0,
\qquad
g(x,y)=0
$$

을 동시에 만족하는 점이다.

## 예제

$$
\begin{cases}
x'=x(1-x)\\
y'=-y
\end{cases}
$$

첫 번째 식에서

$$
x(1-x)=0
$$

이므로 $x=0$ 또는 $x=1$이고,

두 번째 식에서는 $y=0$이다.

따라서 임계점은

$$
\boxed{
(0,0),\qquad(1,0)
}
$$

이다.

---

# 14. 비선형계의 선형화

비선형 시스템

$$
\begin{cases}
x'=f(x,y)\\
y'=g(x,y)
\end{cases}
$$

에서 임계점 $$(x^*,y^*)$$ 근처의 거동을 분석하기 위해 **야코비안 행렬(Jacobian matrix)** 을 사용한다.

$$
\boxed{
J(x,y)=
\begin{bmatrix}
\dfrac{\partial f}{\partial x}
&
\dfrac{\partial f}{\partial y}
\\[6pt]
\dfrac{\partial g}{\partial x}
&
\dfrac{\partial g}{\partial y}
\end{bmatrix}
}
$$

임계점에서

$$
A=J(x^*,y^*)
$$

를 계산하면 임계점 근처에서는

$$
\mathbf{u}'\approx A\mathbf{u}
$$

라는 선형계로 근사할 수 있다.

즉

$$
\boxed{
\text{비선형계}
\longrightarrow
\text{임계점}
\longrightarrow
\text{Jacobian}
\longrightarrow
\text{고유값}
}
$$

순서로 분석한다.

---

# 15. 예제 4: 비선형계 선형화

$$
\begin{cases}
x'=x-x^2\\
y'=-y
\end{cases}
$$

임계점은

$$
(0,0),\qquad(1,0)
$$

이다.

야코비안은

$$
J(x,y)=
\begin{bmatrix}
1-2x&0\\
0&-1
\end{bmatrix}
$$

이다.

## 15.1 임계점 $(0,0)$

$$
J(0,0)=
\begin{bmatrix}
1&0\\
0&-1
\end{bmatrix}
$$

고유값은 $1,-1$이므로 안장점이고 불안정하다.

## 15.2 임계점 $(1,0)$

$$
J(1,0)=
\begin{bmatrix}
-1&0\\
0&-1
\end{bmatrix}
$$

고유값이 둘 다 음수이므로 안정적인 임계점이다.

---

# 16. 선형계와 비선형계의 차이

## 선형계

$$
\mathbf{x}'=A\mathbf{x}
$$

행렬 $A$의 고유값을 계산한다.

## 비선형계

$$
\mathbf{x}'=\mathbf{f}(\mathbf{x})
$$

1. 임계점을 찾는다.
2. 임계점에서 Jacobian을 구한다.
3. Jacobian의 고유값을 계산한다.
4. 임계점 근처의 안정성을 판단한다.

---

# 17. 방향장이란?

위상평면의 각 점 $(x_1,x_2)$에서

$$
\begin{bmatrix}
x_1'\\
x_2'
\end{bmatrix}
$$

를 계산하면 그 점에서 상태가 어느 방향으로 움직이는지 알 수 있다.

이 방향을 평면 전체에 화살표로 표시한 것이 **방향장(vector field)** 이다.

---

# 18. 전자공학과의 연결

위상평면과 안정성은 이후 다음 과목에서 다시 등장한다.

- 제어공학의 상태공간 해석
- 시스템의 극점과 안정성
- RLC 회로의 과도응답
- 발진기
- 비선형 회로
- PLL
- 로봇 및 동역학 시스템

특히 제어공학에서는

$$
\mathbf{x}'=A\mathbf{x}+B\mathbf{u}
$$

형태의 상태방정식을 다루기 때문에 이번 장의 내용이 그대로 연결된다.

---

# 연습문제

## 문제 1

다음 시스템의 임계점 종류를 판별하여라.

$$
\mathbf{x}'
=
\begin{bmatrix}
-2&0\\
0&-5
\end{bmatrix}
\mathbf{x}
$$

### 풀이

고유값은

$$
\lambda_1=-2,\qquad \lambda_2=-5
$$

이다.

둘 다 음수이므로 원점은 **안정 마디**이고 점근 안정이다.

---

## 문제 2

$$
\mathbf{x}'
=
\begin{bmatrix}
2&0\\
0&-3
\end{bmatrix}
\mathbf{x}
$$

고유값은 $2,-3$이므로 **안장점**이다.

---

## 문제 3

$$
\mathbf{x}'
=
\begin{bmatrix}
-1&-3\\
3&-1
\end{bmatrix}
\mathbf{x}
$$

고유값은

$$
\lambda=-1\pm3j
$$

이므로 **안정 나선**이다.

---

## 문제 4

$$
\mathbf{x}'
=
\begin{bmatrix}
0&-2\\
2&0
\end{bmatrix}
\mathbf{x}
$$

고유값은

$$
\lambda=\pm2j
$$

이므로 **중심**이다.

---

## 문제 5

다음 비선형 시스템의 임계점을 구하여라.

$$
\begin{cases}
x'=x(2-x)\\
y'=-2y
\end{cases}
$$

### 풀이

$$
x(2-x)=0
$$

이므로 $x=0$ 또는 $x=2$이고, $y=0$이다.

따라서 임계점은

$$
\boxed{
(0,0),\qquad(2,0)
}
$$

이다.

---

# 마지막 핵심 정리

## 핵심 1

위상평면은

$$
(x_1(t),x_2(t))
$$

를 하나의 움직이는 점으로 보는 방법이다.

## 핵심 2

임계점은

$$
x_1'=0,\qquad x_2'=0
$$

인 점이다.

## 핵심 3

선형계에서는 고유값이 위상평면의 형태와 안정성을 결정한다.

## 핵심 4

$$
\operatorname{Re}(\lambda)<0
$$

이면 감쇠하고,

$$
\operatorname{Re}(\lambda)>0
$$

이면 성장한다.

## 핵심 5

복소 고유값의 허수부는 회전과 진동을 만든다.

## 핵심 6

비선형계에서는

$$
\boxed{
\text{임계점}
\rightarrow
\text{Jacobian}
\rightarrow
\text{고유값}
\rightarrow
\text{안정성 판정}
}
$$

순서로 분석한다.
