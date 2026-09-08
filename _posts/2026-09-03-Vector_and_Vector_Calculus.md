---
layout: single
classes: vector-calculus-post
title: "Vector and Vector Calculus"
categories: Math
tags: [Math, Linear Algebra, Vector Calculus, Electromagnetics]
toc: true
author_profile: false
comments: true
---

공업수학에서 **벡터와 행렬**은 여러 개의 값과 상태를 한꺼번에 다루는 언어이고, **벡터 미적분학**은 공간에 분포한 전기장·자기장처럼 위치에 따라 변하는 양을 다루는 언어이다.

전자공학에서는 이 두 분야가 거의 모든 분야와 연결된다.

- 회로망 해석: 여러 노드 전압을 벡터로 묶고 행렬방정식으로 계산
- 신호 및 시스템: 신호를 벡터공간의 원소로 보고 직교기저로 분해
- 제어: 상태방정식과 고유값으로 시스템의 자연응답과 안정성 해석
- 통신: 최소제곱, 직교신호, 복소벡터와 행렬
- 전자기학: Gradient, Divergence, Curl, 선적분, 면적분, Stokes 정리

벡터·기저·행렬에서 출발해 곡선과 장의 미분을 배우고, 선·면·체적 적분을 거쳐 전자기학으로 연결한다.

| 먼저 익힐 도구 | 공간의 장에서 사용하는 곳 |
|---|---|
| 내적과 정사영 | 방향도함수, 일, 플럭스 |
| 외적과 행렬식 | 법선벡터, 면적·체적의 배율 |
| 기저와 좌표 | 좌표계 선택, 성분 표현 |
| 미분과 적분 | 국소 변화와 영역 전체의 양 연결 |

## 1. 벡터공간

### 1.1. 벡터는 단순한 화살표보다 넓은 개념이다

기하학에서 벡터는 크기와 방향을 가진 화살표로 배운다.

예를 들어

$$
\mathbf v
=
\begin{bmatrix}
3\\
4
\end{bmatrix}
$$

의 크기는

$$
\lVert\mathbf v\rVert
=
\sqrt{3^2+4^2}
=
5
$$

이다.

하지만 선형대수에서 벡터는 반드시 공간의 화살표일 필요가 없다.

다음과 같은 대상도 벡터처럼 다룰 수 있다.

$$
\begin{bmatrix}
v_1\\
v_2\\
v_3
\end{bmatrix},
\qquad
a_0+a_1x+a_2x^2,
\qquad
f(t)
$$

핵심은 **벡터끼리 더하고 스칼라를 곱했을 때 같은 종류의 대상으로 남는가**이다.

---

### 1.2. 벡터공간

집합 $V$의 원소들을 벡터라고 하자.

두 벡터

$$
\mathbf u,\mathbf v\in V
$$

와 스칼라 $a,b$에 대해

$$
a\mathbf u+b\mathbf v
$$

도 다시 $V$에 속하고, 덧셈과 스칼라배가 일반적인 연산법칙을 만족하면 $V$를 **벡터공간(vector space)**이라고 한다.

예를 들어

$$
\mathbb R^2
=
\left\{
\begin{bmatrix}
x\\
y
\end{bmatrix}
:x,y\in\mathbb R
\right\}
$$

는 벡터공간이다.

---

### 1.3. 선형결합과 Span

벡터

$$
\mathbf v_1,\mathbf v_2,\ldots,\mathbf v_n
$$

에 대해

$$
\boxed{
c_1\mathbf v_1+c_2\mathbf v_2+\cdots+c_n\mathbf v_n
}
$$

을 선형결합이라고 한다.

이런 모든 선형결합으로 만들 수 있는 집합을 Span이라고 한다.

$$
\boxed{
\operatorname{span}
\{\mathbf v_1,\ldots,\mathbf v_n\}
}
$$

예를 들어

$$
\mathbf e_1=
\begin{bmatrix}
1\\
0
\end{bmatrix},
\qquad
\mathbf e_2=
\begin{bmatrix}
0\\
1
\end{bmatrix}
$$

이면

$$
\begin{bmatrix}
x\\
y
\end{bmatrix}
=
x\mathbf e_1+y\mathbf e_2
$$

이므로 $\mathbf e_1,\mathbf e_2$가 평면 전체를 만든다.

---

### 1.4. 선형독립

$$
c_1\mathbf v_1+\cdots+c_n\mathbf v_n=\mathbf0
$$

을 만족시키는 계수가

$$
c_1=\cdots=c_n=0
$$

뿐이라면 벡터들은 **선형독립**이다.

예를 들어

$$
\mathbf v_1=
\begin{bmatrix}
1\\
2
\end{bmatrix},
\qquad
\mathbf v_2=
\begin{bmatrix}
2\\
4
\end{bmatrix}
$$

는

$$
\mathbf v_2=2\mathbf v_1
$$

이므로 선형종속이다.

둘이 서로 다른 정보처럼 보이지만 사실 같은 방향의 정보만 가지고 있다.

---

### 1.5. 기저와 차원

벡터공간 전체를 만들 수 있으면서 서로 선형독립인 벡터 집합을 **기저(basis)**라고 한다.

$\mathbb R^3$의 표준기저는

$$
\mathbf e_1=
\begin{bmatrix}
1\\0\\0
\end{bmatrix},
\quad
\mathbf e_2=
\begin{bmatrix}
0\\1\\0
\end{bmatrix},
\quad
\mathbf e_3=
\begin{bmatrix}
0\\0\\1
\end{bmatrix}
$$

이다.

기저 벡터의 개수를 차원이라고 하므로

$$
\dim\mathbb R^3=3
$$

이다.

---

### 1.6. 전자공학 연결: 신호도 벡터로 볼 수 있다

한 주파수 $\omega$에 대해

$$
\cos\omega t,
\qquad
\sin\omega t
$$

를 두 개의 기저함수라고 생각하자.

그러면

$$
x(t)
=
3\cos\omega t+2\sin\omega t
$$

는 이 두 기저의 선형결합이다.

즉 신호도 함수공간의 벡터로 볼 수 있다.

이 관점은 이후 Fourier 해석, 통신의 I/Q 표현과 연결된다.

---

## 2. 그램–슈미트 직교화

### 2.1. 왜 직교기저가 좋은가?

기저끼리 직교하면 각 성분을 쉽게 분리할 수 있다.

벡터 $\mathbf v$를 $\mathbf u$ 방향으로 내린 성분은

$$
\boxed{
\operatorname{proj}_{\mathbf u}\mathbf v
=
\frac{
\mathbf v\cdot\mathbf u
}{
\mathbf u\cdot\mathbf u
}
\mathbf u
}
$$

이다.

$\mathbf u$가 단위벡터이면

$$
\operatorname{proj}_{\mathbf u}\mathbf v
=
(\mathbf v\cdot\mathbf u)\mathbf u
$$

가 된다.

---

{% include vector-calculus/projection.html %}
*그림 1. 원래 벡터에서 이미 확보한 방향 성분을 빼면 그 방향에 수직인 잔차가 남는다. 최소제곱법도 같은 정사영 원리를 사용한다.*

### 2.2. Gram–Schmidt의 핵심

서로 독립이지만 직교하지 않은

$$
\mathbf v_1,\mathbf v_2,\mathbf v_3
$$

에서 직교기저를 만들고 싶다.

첫 번째는 그대로 둔다.

$$
\mathbf u_1=\mathbf v_1
$$

두 번째에서 첫 번째 방향 성분을 뺀다.

$$
\boxed{
\mathbf u_2
=
\mathbf v_2
-
\operatorname{proj}_{\mathbf u_1}\mathbf v_2
}
$$

세 번째에서는 이미 만든 두 방향을 모두 제거한다.

$$
\boxed{
\mathbf u_3
=
\mathbf v_3
-
\operatorname{proj}_{\mathbf u_1}\mathbf v_3
-
\operatorname{proj}_{\mathbf u_2}\mathbf v_3
}
$$

즉 **이미 확보한 방향의 성분을 계속 제거하면서 새로운 독립 방향만 남기는 과정**이다.

---

### 2.3. 예제

$$
\mathbf v_1=
\begin{bmatrix}
1\\
1
\end{bmatrix},
\qquad
\mathbf v_2=
\begin{bmatrix}
1\\
0
\end{bmatrix}
$$

라고 하자.

$$
\mathbf u_1=\mathbf v_1
$$

이다.

정사영은

$$
\operatorname{proj}_{\mathbf u_1}\mathbf v_2
=
\frac{1}{2}
\begin{bmatrix}
1\\
1
\end{bmatrix}
$$

이므로

$$
\mathbf u_2
=
\begin{bmatrix}
1\\
0
\end{bmatrix}
-
\frac12
\begin{bmatrix}
1\\
1
\end{bmatrix}
=
\begin{bmatrix}
1/2\\
-1/2
\end{bmatrix}
$$

이다.

실제로

$$
\mathbf u_1\cdot\mathbf u_2=0
$$

이다.

정규화하면

$$
\boxed{
\mathbf q_1=
\frac1{\sqrt2}
\begin{bmatrix}
1\\
1
\end{bmatrix},
\qquad
\mathbf q_2=
\frac1{\sqrt2}
\begin{bmatrix}
1\\
-1
\end{bmatrix}
}
$$

이다.

---

### 2.4. 전자공학 연결

신호공간에서 내적을

$$
\langle f,g\rangle
=
\int_{t_1}^{t_2}f(t)g(t)\,dt
$$

로 정의할 수 있다.

두 신호의 내적이 0이면 서로 직교한다.

직교신호는 서로의 성분을 깔끔하게 분리할 수 있기 때문에 통신과 신호처리에서 중요하다.

---

## 3. 행렬 대수

### 3.1. 행렬은 선형변환을 표현한다

행렬

$$
A=
\begin{bmatrix}
2&0\\
0&3
\end{bmatrix}
$$

가 벡터

$$
\mathbf x=
\begin{bmatrix}
x\\
y
\end{bmatrix}
$$

에 작용하면

$$
A\mathbf x
=
\begin{bmatrix}
2x\\
3y
\end{bmatrix}
$$

이다.

즉 $x$방향은 2배, $y$방향은 3배로 늘리는 변환이다.

---

### 3.2. 행렬곱은 변환의 합성이다

행렬 $B$를 먼저 적용하고 그다음 $A$를 적용하면

$$
A(B\mathbf x)
$$

이다.

이를 하나의 행렬로 나타내기 위해

$$
\boxed{
(AB)\mathbf x=A(B\mathbf x)
}
$$

가 되도록 행렬곱을 정의한다.

따라서 일반적으로

$$
\boxed{
AB\ne BA
}
$$

이다.

변환의 순서를 바꾸면 결과가 달라질 수 있기 때문이다.

---

### 3.3. 단위행렬과 역행렬

단위행렬 $I$는 아무 변화도 하지 않는다.

$$
I\mathbf x=\mathbf x
$$

이다.

역행렬 $A^{-1}$은 $A$의 변환을 되돌린다.

$$
\boxed{
A^{-1}A=AA^{-1}=I
}
$$

이다.

$2\times2$ 행렬

$$
A=
\begin{bmatrix}
a&b\\
c&d
\end{bmatrix}
$$

에서

$$
ad-bc\ne0
$$

이면

$$
\boxed{
A^{-1}
=
\frac1{ad-bc}
\begin{bmatrix}
d&-b\\
-c&a
\end{bmatrix}
}
$$

이다.

---

### 3.4. 행렬식

$$
\boxed{
\det A=ad-bc
}
$$

이다.

기하학적으로

$$
\vert\det A\vert
$$

는 면적의 확대비와 연결된다.

또

$$
\det A=0
$$

이면 어떤 방향이 눌려 차원이 줄어들기 때문에 역행렬이 존재하지 않는다.

---

### 3.5. 전치와 켤레전치

행과 열을 바꾼 행렬은

$$
A^T
$$

이다.

복소수 행렬에서는 켤레까지 취한

$$
\boxed{
A^H=\overline A^T
}
$$

를 자주 사용한다.

전자공학에서는 RF, 통신, 신호처리에서 복소벡터가 기본적으로 등장하므로 $A^H$가 매우 중요하다.

---

## 4. 연립선형대수 방정식

### 4.1. 행렬형

연립방정식

$$
\begin{aligned}
2x+y&=5,\\
x-y&=1
\end{aligned}
$$

은

$$
\boxed{
A\mathbf x=\mathbf b
}
$$

로 쓸 수 있다.

$$
A=
\begin{bmatrix}
2&1\\
1&-1
\end{bmatrix},
\quad
\mathbf x=
\begin{bmatrix}
x\\
y
\end{bmatrix},
\quad
\mathbf b=
\begin{bmatrix}
5\\
1
\end{bmatrix}
$$

이다.

---

### 4.2. 가우스 소거법

확대행렬은

$$
\left[
\begin{array}{cc|c}
2&1&5\\
1&-1&1
\end{array}
\right]
$$

이다.

행을 바꾼 뒤

$$
\left[
\begin{array}{cc|c}
1&-1&1\\
2&1&5
\end{array}
\right]
$$

에서 두 번째 행에

$$
R_2\leftarrow R_2-2R_1
$$

을 적용하면

$$
\left[
\begin{array}{cc|c}
1&-1&1\\
0&3&3
\end{array}
\right]
$$

이다.

따라서

$$
y=1,\qquad x=2
$$

이다.

---

### 4.3. 전자공학 연결: 노드해석

회로의 여러 노드전압을

$$
\mathbf v
=
\begin{bmatrix}
v_1\\
v_2\\
v_3
\end{bmatrix}
$$

로 묶으면 Kirchhoff 전류법칙을

$$
\boxed{
G\mathbf v=\mathbf i
}
$$

와 같은 행렬방정식으로 표현할 수 있다.

큰 회로망 해석은 결국 큰 연립선형방정식을 푸는 문제이다.

---

## 5. 고유값

### 5.1. 고유벡터

행렬 $A$를 적용했을 때 같은 직선 위에 남는 **0이 아닌 벡터**를 생각하자. 고유값이 음수이면 방향이 뒤집히고, 0이면 영벡터로 보내진다.

$$
\boxed{
A\mathbf v=\lambda\mathbf v
}
$$

이다.

$\mathbf v$는 고유벡터, $\lambda$는 고유값이다.

---

### 5.2. 고유값 계산

$$
A\mathbf v=\lambda\mathbf v
$$

를 정리하면

$$
(A-\lambda I)\mathbf v=0
$$

이다.

0이 아닌 $\mathbf v$가 존재하려면

$$
A-\lambda I
$$

가 역행렬을 가지면 안 되므로

$$
\boxed{
\det(A-\lambda I)=0
}
$$

이어야 한다.

---

### 5.3. 예제

$$
A=
\begin{bmatrix}
2&1\\
1&2
\end{bmatrix}
$$

라고 하자.

$$
\det(A-\lambda I)
=
(2-\lambda)^2-1=0
$$

이므로

$$
\boxed{
\lambda_1=3,
\qquad
\lambda_2=1
}
$$

이다.

각 고유벡터 방향은

$$
\boxed{
\mathbf v_1=
\begin{bmatrix}
1\\
1
\end{bmatrix},
\qquad
\mathbf v_2=
\begin{bmatrix}
1\\
-1
\end{bmatrix}
}
$$

이다.

---

{% include vector-calculus/eigenvectors.html %}
*그림 2. 이 행렬은 $(1,1)$ 방향을 3배 늘리고 $(1,-1)$ 방향은 그대로 둔다.*

### 5.4. 전자공학 연결: 자연모드

상태방정식

$$
\frac{d\mathbf x}{dt}=A\mathbf x
$$

에서

$$
\mathbf x(t)=\mathbf v e^{\lambda t}
$$

를 넣으면

$$
A\mathbf v=\lambda\mathbf v
$$

가 나온다.

즉 시스템의 자연응답은 고유값으로 결정된다.

- $\operatorname{Re}\lambda<0$: 감쇠
- $\operatorname{Re}\lambda>0$: 성장
- $\operatorname{Im}\lambda\ne0$: 진동

라플라스 변환에서 극점의 위치를 해석한 것과 같은 구조이다.

---

## 6. 직교행렬

실수 정사각행렬 $Q$가

$$
\boxed{
Q^TQ=I
}
$$

를 만족하면 직교행렬이다.

따라서

$$
Q^{-1}=Q^T
$$

이다.

직교행렬은 길이와 각도를 보존한다.

$$
\lVert Q\mathbf x\rVert
=
\lVert\mathbf x\rVert
$$

이다.

대표적인 예가 2차원 회전행렬이다.

$$
\boxed{
Q(\theta)
=
\begin{bmatrix}
\cos\theta&-\sin\theta\\
\sin\theta&\cos\theta
\end{bmatrix}
}
$$

이다.

---

## 7. 대각화

### 7.1. 왜 대각화하는가?

대각행렬

$$
D=
\begin{bmatrix}
\lambda_1&0\\
0&\lambda_2
\end{bmatrix}
$$

은 계산이 쉽다.

예를 들어

$$
D^n
=
\begin{bmatrix}
\lambda_1^n&0\\
0&\lambda_2^n
\end{bmatrix}
$$

이다.

---

### 7.2. 고유벡터를 새로운 기저로 사용한다

독립인 고유벡터들을 열로 모아

$$
P=
\begin{bmatrix}
\vert&\vert&&\vert\\
\mathbf v_1&\mathbf v_2&\cdots&\mathbf v_n\\
\vert&\vert&&\vert
\end{bmatrix}
$$

라고 하자.

그러면

$$
\boxed{
P^{-1}AP=D
}
$$

이고,

$$
\boxed{
A=PDP^{-1}
}
$$

이다.

이것이 대각화이다. $n\times n$ 행렬에 선형독립인 고유벡터가 $n$개 있어야 가능하다. 고유값이 중복된다는 이유만으로 실패하는 것은 아니지만, 필요한 수의 고유벡터가 부족하면 대각화할 수 없다.

핵심 의미는 다음과 같다.

> 원래 좌표계에서는 여러 성분이 서로 섞여 있지만, 고유벡터를 기저로 사용하면 각 모드가 독립적으로 움직인다.

---

### 7.3. 전자공학 연결

$$
\frac{d\mathbf x}{dt}=A\mathbf x
$$

에서

$$
\mathbf z=P^{-1}\mathbf x
$$

로 바꾸면

$$
\frac{d\mathbf z}{dt}=D\mathbf z
$$

가 된다.

즉

$$
z_1^\prime=\lambda_1z_1,
\qquad
z_2^\prime=\lambda_2z_2
$$

처럼 서로 독립적인 1계 방정식으로 분리된다.

---

## 8. 최소제곱법

### 8.1. 왜 필요한가?

측정 데이터에는 노이즈가 있기 때문에

$$
A\mathbf x=\mathbf b
$$

를 정확히 만족하는 $\mathbf x$가 없을 수 있다.

이때

$$
\mathbf r
=
\mathbf b-A\hat{\mathbf x}
$$

를 잔차라고 하고,

$$
\boxed{
\lVert\mathbf r\rVert^2
}
$$

를 가장 작게 만드는 $\hat{\mathbf x}$를 찾는다.

---

### 8.2. 정상방정식

최적의 잔차는 $A$의 열공간에 직교한다.

따라서

$$
A^T\mathbf r=0
$$

이다.

즉

$$
A^T(\mathbf b-A\hat{\mathbf x})=0
$$

이고,

$$
\boxed{
A^TA\hat{\mathbf x}
=
A^T\mathbf b
}
$$

이다.

$A$의 열들이 선형독립이면 $A^TA$가 가역이고

$$
\boxed{
\hat{\mathbf x}
=
(A^TA)^{-1}A^T\mathbf b
}
$$

이다.

---

실제 수치 계산에서는 역행렬을 직접 만들기보다 QR 분해나 SVD를 사용한다. 복소벡터에서는 내적에 켤레를 포함하며 정상방정식의 $A^T$를 $A^H$로 바꾼다.

### 8.3. 전자공학 연결

최소제곱법은 다음과 같은 곳에서 사용된다.

- 센서 캘리브레이션
- 시스템 식별
- 통신 채널 추정
- 노이즈가 있는 측정값에서 파라미터 추정
- 안테나 배열과 신호처리

예를 들어

$$
\mathbf y
=
H\mathbf x+\mathbf n
$$

에서 $\mathbf x$를 추정하는 문제와 직접 연결된다.

---

## 9. 벡터함수: 곡선을 미분한다

### 위치·속도·가속도와 호의 길이

벡터함수 $\mathbf r(t)=(x(t),y(t),z(t))$는 매개변수 하나로 공간의 곡선을 그린다. 반면 벡터장 $\mathbf F(x,y,z)$는 공간의 **각 위치에 벡터를 배정**한다. 곡선 위에서 장을 읽으면 $\mathbf F(\mathbf r(t))$가 된다. 이 둘을 구분해야 선적분에서 무엇을 대입하고 무엇을 미분하는지 헷갈리지 않는다.

$$
\begin{aligned}
\mathbf v(t)&=\mathbf r'(t), & v(t)&=\lVert\mathbf r'(t)\rVert,\\
\mathbf a(t)&=\mathbf r''(t), & s(t)&=\int_{t_0}^{t}\lVert\mathbf r'(u)\rVert\,du.
\end{aligned}
$$

$\mathbf v$는 방향을 가진 속도, $v$는 음수가 아닌 속력이다. $ds/dt=v$이므로 미소 이동벡터와 미소 길이는 다음처럼 다르다.

$$
d\mathbf r=\mathbf r'(t)\,dt,
\qquad ds=\lVert\mathbf r'(t)\rVert\,dt.
$$

### 곡률과 접선·법선 가속도

속력이 0이 아닌 정칙곡선에서 접선 단위벡터를 정의한다.

$$
\mathbf T=\frac{\mathbf r'}{\lVert\mathbf r'\rVert},
\qquad \kappa=\left\lVert\frac{d\mathbf T}{ds}\right\rVert
=\frac{\lVert\mathbf r'\times\mathbf r''\rVert}{\lVert\mathbf r'\rVert^3}.
$$

곡률은 **이동거리당 방향 변화량**이다. $\kappa>0$이면 주법선은 $\mathbf N=(d\mathbf T/ds)/\kappa$, 곡률반경은 $1/\kappa$이다. $\mathbf v=v\mathbf T$를 곱의 법칙으로 미분하면

$$
\boxed{\mathbf a=\frac{dv}{dt}\mathbf T+\kappa v^2\mathbf N}
$$

를 얻는다. 접선 성분은 속력을 바꾸고, 법선 성분은 방향을 바꾼다. 따라서 **속력이 일정해도 가속도는 0이 아닐 수 있다.** 직선 구간처럼 $\kappa=0$이면 법선 성분은 0이며 이 식으로 주법선을 정의할 수는 없다.

### 계산 예제: 원운동

$R>0$이고 $\omega\ne0$인 원운동을 보자.

$$
\begin{aligned}
\mathbf r(t)&=(R\cos\omega t,R\sin\omega t,0),\\
\mathbf v(t)&=(-R\omega\sin\omega t,R\omega\cos\omega t,0),\\
\mathbf a(t)&=-\omega^2\mathbf r(t).
\end{aligned}
$$

속력은 $R\lvert\omega\rvert$, 곡률은 $1/R$이다. 따라서 접선가속도는 0이고 법선가속도의 크기는 $R\omega^2=v^2/R$이다. 회전 방향을 바꿔도 가속도는 중심을 향한다.

## 10. 내적·외적과 장의 종류

벡터장을 적분하기 전에 두 종류의 곱을 구별하자. 내적은 한 방향으로의 성분을 고르고, 외적은 두 방향이 만드는 면적과 법선을 준다.

$$
\mathbf a\cdot\mathbf b=\lVert\mathbf a\rVert\lVert\mathbf b\rVert\cos\theta,
\qquad
\lVert\mathbf a\times\mathbf b\rVert=\lVert\mathbf a\rVert\lVert\mathbf b\rVert\sin\theta.
$$

| 대상 | 입력 → 출력 | 전자공학 예 | 읽는 방법 |
|---|---|---|---|
| 스칼라장 $f$ | 위치 → 수 | 전위, 온도 | 그 점의 값은 얼마인가? |
| 벡터장 $\mathbf F$ | 위치 → 벡터 | 전기장, 전류밀도 | 그 점에서 어느 방향으로 얼마나 작용하는가? |
| $\mathbf F\cdot\mathbf T$ | 두 벡터 → 수 | 경로 방향의 전기장 | 이동방향 성분 |
| $\mathbf F\cdot\mathbf n$ | 두 벡터 → 수 | 면을 통과하는 전류밀도 | 법선방향 성분 |
| $\mathbf r_u\times\mathbf r_v$ | 두 접벡터 → 벡터 | 곡면의 면적벡터 | 면적 배율과 방향 |

여기서 $\mathbf T$와 $\mathbf n$은 단위벡터이다. 외적의 순서를 바꾸면 부호가 바뀐다. 이것이 면적분에서 방향 선택이 중요한 이유다.

## 11. Gradient와 방향도함수

### 편미분을 모으면 왜 벡터가 되는가?

미분 가능한 스칼라장 $f$에서 작은 이동 $\Delta\mathbf r$에 따른 변화는 1차 근사로

$$
\Delta f\approx f_x\Delta x+f_y\Delta y+f_z\Delta z
=\nabla f\cdot\Delta\mathbf r
$$

이다. 따라서 각 좌표방향의 변화율을 모은

$$
\boxed{\nabla f=(f_x,f_y,f_z)}
$$

가 공간 변화율을 한 번에 나타낸다. 아래에서 사용하는 성분 공식은 모두 **직교 Cartesian 좌표계** 기준이다.

단위벡터 $\mathbf u$ 방향으로 거리 $h$만큼 움직이는 경로 $\mathbf r(h)=\mathbf p+h\mathbf u$에 연쇄법칙을 적용하면

$$
D_{\mathbf u}f(\mathbf p)
=\left.\frac{d}{dh}f(\mathbf p+h\mathbf u)\right|_{h=0}
=\nabla f(\mathbf p)\cdot\mathbf u.
$$

Cauchy–Schwarz 부등식에 의해 최대값은 $\lVert\nabla f\rVert$이고, $\nabla f\ne\mathbf0$일 때 그 방향은 $\nabla f/\lVert\nabla f\rVert$이다. Gradient가 0인 점에서는 1차 변화만으로 최대 증가방향을 고를 수 없다.

{% include vector-calculus/gradient.html %}
*그림 3. 등고선을 따라서는 함수값이 변하지 않는다. Gradient는 그 접선에 수직이며 값이 증가하는 쪽을 향한다. 화살표 길이는 방향을 보기 위한 축척이다.*

### 계산 예제: 단위벡터를 먼저 만든다

$f=x^2+2y^2$에서 $P=(1,1)$, 방향벡터 $\mathbf a=(1,1)$이면

$$
\nabla f(P)=(2,4),\qquad
\mathbf u=\frac{\mathbf a}{\lVert\mathbf a\rVert}=\frac{(1,1)}{\sqrt2}.
$$

따라서 $D_{\mathbf u}f=3\sqrt2$이다. 최대 증가율은 $2\sqrt5$이며 최대 증가방향 $(1,2)/\sqrt5$는 $\mathbf u$와 다르다. $\mathbf a$를 정규화하지 않으면 거리당 변화율 대신 매개변수당 변화율을 계산하게 된다.

### 등위면의 법선과 접평면

곡면 $F(x,y,z)=C$ 위의 곡선에서는 $F(\mathbf r(t))=C$이므로

$$
\nabla F\cdot\mathbf r'(t)=0.
$$

즉 $\nabla F(P)\ne\mathbf0$인 점에서 Gradient는 법선이고 접평면은

$$
\boxed{\nabla F(P)\cdot(\mathbf r-\mathbf p)=0}
$$

이다. 구면 $x^2+y^2+z^2=9$의 $P=(1,2,2)$에서는 법선이 $(2,4,4)$이므로 접평면은 $x+2y+2z=9$이다.

### 전위와 전기장

정전기장에서는 $\mathbf E=-\nabla V$이다. 전위가 가장 빨리 낮아지는 쪽이 전기장 방향이고, 전위의 단위가 V이면 전기장은 V/m이다. 시간에 따라 자기장이 변하는 일반적인 상황에서는 스칼라 전위의 Gradient만으로 전기장 전체를 표현할 수 없다.

## 12. 발산: 작은 부피에서 나가는 순유량

### 정의를 작은 상자로 이해하기

$\mathbf F=(F_x,F_y,F_z)$에서 $x$방향 두 면을 통과하는 순유량은

$$
\begin{aligned}
&\bigl[F_x(x+\Delta x,y,z)-F_x(x,y,z)\bigr]\Delta y\Delta z\\
&\qquad\approx \frac{\partial F_x}{\partial x}\Delta x\Delta y\Delta z.
\end{aligned}
$$

나머지 두 방향도 더하고 부피로 나누면 발산이 나온다.

$$
\boxed{\nabla\cdot\mathbf F
=\frac{\partial F_x}{\partial x}
+\frac{\partial F_y}{\partial y}
+\frac{\partial F_z}{\partial z}}
$$

발산은 벡터가 아니라 **부피당 순유출량을 나타내는 스칼라**다. 양수면 순유출, 음수면 순유입, 0이면 유입과 유출의 균형을 뜻한다. 발산이 0이라고 장 자체가 0인 것은 아니다.

{% include vector-calculus/fields.html %}
*그림 4. 왼쪽은 발산만, 가운데는 회전만 있으며 오른쪽은 둘 다 0이다. 그림은 $z$성분이 0인 평면 벡터장이다.*

### 계산 예제와 전하밀도

$\mathbf F=(x,y,z)$에서는 발산이 $3$이다. 한 변이 $2a$인 원점 중심 정육면체의 각 면에서는 바깥 법선 성분이 $a$이고 넓이가 $4a^2$이다. 여섯 면의 총 플럭스는 $24a^3$이다. 이를 부피 $8a^3$으로 나누면 정확히 $3$이 된다.

전기변위장 $\mathbf D$에 대해서는

$$
\nabla\cdot\mathbf D=\rho_v
$$

이다. $\mathbf D$의 단위 C/m²를 공간에 대해 미분하면 전하밀도 C/m³가 된다는 점도 의미와 맞는다. 진공에서는 $\mathbf D=\varepsilon_0\mathbf E$이다.

## 13. Curl: 작은 고리를 따라 도는 순환

### 국소 순환과 오른손 법칙

작은 고리의 접선방향 장을 더한 뒤 면적으로 나누면 Curl의 법선 성분이 된다.

$$
(\nabla\times\mathbf F)\cdot\mathbf n
=\lim_{\Delta S\to0}\frac{1}{\Delta S}
\oint_{\partial(\Delta S)}\mathbf F\cdot d\mathbf r.
$$

법선 방향은 오른손 엄지, 고리의 양의 진행방향은 나머지 손가락이 감기는 방향이다. **Curl은 순환의 축과 세기를 갖는 벡터**다.

$$
\nabla\times\mathbf F=
\begin{pmatrix}
\partial F_z/\partial y-\partial F_y/\partial z\\
\partial F_x/\partial z-\partial F_z/\partial x\\
\partial F_y/\partial x-\partial F_x/\partial y
\end{pmatrix}.
$$

### 계산 예제: 회전은 있지만 발산은 없는 장

$\mathbf F=(-y,x,0)$이면

$$
\nabla\cdot\mathbf F=0,
\qquad \nabla\times\mathbf F=(0,0,2).
$$

반지름 $a$인 반시계 원에서는 장이 접선방향이고 크기가 $a$이므로 순환은 $a(2\pi a)=2\pi a^2$이다. 원판 넓이로 나누면 Curl의 $z$성분 $2$가 된다. 이 장을 유체의 속도장으로 해석하면 각속도는 $1$이고 Curl은 각속도의 두 배이다.

### 회전 모양만 보고 판단하면 안 되는 이유

원점을 제외한 평면의 장

$$
\mathbf F=\left(\frac{-y}{x^2+y^2},\frac{x}{x^2+y^2},0\right)
$$

은 원을 따라 돌지만 정의된 모든 점에서 Curl이 0이다. 반지름 $a$인 원의 순환은 여전히 $2\pi$이다. 원점에서 장이 정의되지 않아서 고리 내부 전체에 Stokes 정리를 적용할 수 없기 때문이다. **국소적인 Curl과 구멍을 감싸는 큰 경로의 순환은 구별해야 한다.**

## 14. 선적분: 길이를 더하는가, 접선 성분을 더하는가?

| 종류 | 매개변수 표현 | 경로를 반대로 돌리면 |
|---|---|---|
| 스칼라 선적분 $\int_C f\,ds$ | $\int_a^b f(\mathbf r(t))\lVert\mathbf r'(t)\rVert\,dt$ | 값이 같다 |
| 벡터 선적분 $\int_C\mathbf F\cdot d\mathbf r$ | $\int_a^b\mathbf F(\mathbf r(t))\cdot\mathbf r'(t)\,dt$ | 부호가 바뀐다 |

첫 번째는 선밀도로부터 철사의 질량을 구할 때, 두 번째는 힘이 한 일이나 전기장의 경로방향 성분을 구할 때 사용한다. 경로를 **벡터장과 같은 방향으로만** 잡아야 하는 것은 아니다. 장과 이동이 반대면 음의 기여가 생긴다.

### 계산 순서

1. 출발점과 도착점에 맞게 $\mathbf r(t)$와 구간을 정한다.
2. 장의 좌표에 경로를 대입해 $\mathbf F(\mathbf r(t))$를 만든다.
3. $d\mathbf r=\mathbf r'(t)\,dt$와 내적한다.
4. 남은 한 변수의 정적분을 계산한다.

{% include vector-calculus/paths.html %}
*그림 5. 회전장에서는 끝점이 같아도 경로가 다르면 적분값이 다르다.*

### 계산 예제: 두 경로의 일이 다르다

$\mathbf F=(-y,x,0)$에서 $A=(0,0)$, $B=(1,1)$로 이동하자.

대각선 $C_1$은 $\mathbf r(t)=(t,t,0)$, $0\le t\le1$이다.

$$
\int_{C_1}\mathbf F\cdot d\mathbf r
=\int_0^1(-t,t,0)\cdot(1,1,0)\,dt=0.
$$

꺾인 경로 $C_2$는 먼저 $(0,0)\to(1,0)$, 다음 $(1,0)\to(1,1)$이다. 첫 구간은 장과 이동이 수직이라 0이다. 두 번째는 $\mathbf r(t)=(1,t,0)$이므로

$$
\int_{C_2}\mathbf F\cdot d\mathbf r
=0+\int_0^1(-t,1,0)\cdot(0,1,0)\,dt=1.
$$

## 15. 보존장과 경로독립성

$\mathbf F=\nabla\phi$로 표현되는 장을 보존장이라고 한다. 연쇄법칙으로

$$
\int_C\nabla\phi\cdot d\mathbf r
=\int_a^b\frac{d}{dt}\phi(\mathbf r(t))\,dt
=\phi(B)-\phi(A).
$$

따라서 경로가 아니라 끝점만 중요하고, 닫힌 경로 적분은 0이다. $C^1$ 벡터장이 **단일연결 열린 영역**에서 Curl 0이면 보존장이다. 앞의 원점이 빠진 평면은 이 충분조건을 만족하지 않는다.

### 퍼텐셜을 직접 찾는 예제

$\mathbf F=(2xy,x^2+2y,0)$에서 $\phi_x=2xy$를 $x$에 대해 적분하면

$$
\phi=x^2y+g(y,z).
$$

$\phi_y=x^2+g_y=x^2+2y$이므로 $g=y^2+h(z)$, $\phi_z=0$이므로 $h$는 상수다. 따라서

$$
\phi=x^2y+y^2+C.
$$

$(0,0,0)$에서 $(1,2,0)$까지 어느 경로로 이동해도 적분값은 $2+4=6$이다. 정전기장의 경우에는 $\mathbf E=-\nabla V$이므로

$$
V(B)-V(A)=-\int_A^B\mathbf E\cdot d\mathbf l
$$

처럼 부호가 반대다.

## 16. 이중적분과 Jacobian

### 영역을 작은 면적으로 나눠 더하기

$\iint_R f\,dA$는 영역의 미소면적마다 $f$를 곱해 더한 값이다. $f=1$이면 넓이, $f=\sigma$가 면전하밀도이면 총전하이다. 예를 들어 삼각형 $0\le y\le x\le1$에서는

$$
\iint_R(x+y)\,dA
=\int_0^1\int_0^x(x+y)\,dy\,dx
=\int_0^1\frac32x^2\,dx=\frac12.
$$

적분 순서를 바꾸면 $0\le y\le1$, $y\le x\le1$이다. 적분 기호의 순서만 바꾸지 말고 **같은 영역을 새 부등식으로 표현**해야 한다.

### 극좌표의 면적요소에 왜 반지름이 붙는가?

{% include vector-calculus/jacobian.html %}
*그림 6. 각도 간격이 같아도 원점에서 멀수록 호가 길어진다. 작은 면적은 $dr$과 $r\,d\theta$의 곱이다.*

좌표변환 $x=x(u,v)$, $y=y(u,v)$의 두 미소변은 일반적으로 직각이 아니므로 면적 배율은 행렬식의 절댓값이다.

$$
\begin{aligned}
J&=\det\begin{pmatrix}x_u&x_v\\y_u&y_v\end{pmatrix},\\
\iint_R f(x,y)\,dA
&=\iint_D f(x(u,v),y(u,v))|J|\,du\,dv.
\end{aligned}
$$

변환은 적분영역 내부에서 일대일이고 충분히 매끄러우며 Jacobian이 0이 아닌 조건을 확인한다. 극좌표의 원점·경계선처럼 면적이 0인 예외는 적절히 처리할 수 있다.

$x=r\cos\theta$, $y=r\sin\theta$이면

$$
J=\det\begin{pmatrix}\cos\theta&-r\sin\theta\\\sin\theta&r\cos\theta\end{pmatrix}=r.
$$

따라서 반지름 $a$인 원판의 넓이는 $\int_0^{2\pi}\int_0^a r\,dr\,d\theta=\pi a^2$이다. $r$을 빠뜨린 결과 $2\pi a$는 넓이가 아니라 길이 차원을 가진다.

## 17. Green 정리: 평면 경계와 내부 연결

$R$이 조각별로 매끄러운 경계를 가진 평면영역이고 $P,Q$가 그 영역을 포함한 근방에서 $C^1$이면

$$
\boxed{\oint_{\partial R}P\,dx+Q\,dy
=\iint_R\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dA}
$$

이다. 양의 경계방향은 **진행할 때 영역이 왼쪽에 오는 방향**이다. 바깥 경계는 반시계, 구멍의 안쪽 경계는 시계방향이다. 작은 조각들의 경계 적분을 합치면 내부의 공유 경계는 반대 방향으로 두 번 지나 상쇄되고 바깥 경계만 남는다.

### 원에서 직접 적분과 비교

$P=-y$, $Q=x$이면 내부 회전은 $2$이다. 반지름 $a$인 원판에서

$$
\oint_{\partial R}(-y\,dx+x\,dy)
=\iint_R2\,dA=2\pi a^2.
$$

이는 원을 매개변수화해 얻은 순환과 같다. $P=-y/2$, $Q=x/2$를 고르면 내부가 $1$이 되어 **닫힌 경계로 넓이 계산**도 가능하다.

$$
\operatorname{Area}(R)=\frac12\oint_{\partial R}(x\,dy-y\,dx).
$$

## 18. 면적분: 곡면을 통과하는 플럭스

### 면적과 방향을 함께 계산하기

곡면을 $\mathbf r(u,v)$로 매개변수화하면 두 접벡터가 만드는 작은 평행사변형의 면적이 면적요소다.

$$
\begin{aligned}
dS&=\lVert\mathbf r_u\times\mathbf r_v\rVert\,du\,dv,\\
d\mathbf S&=\mathbf n\,dS=(\mathbf r_u\times\mathbf r_v)\,du\,dv.
\end{aligned}
$$

외적 방향이 원하는 법선과 반대라면 부호를 뒤집는다. 스칼라 면적분은 $\iint_S f\,dS$, 플럭스는 다음과 같다.

$$
\boxed{\iint_S\mathbf F\cdot d\mathbf S
=\iint_D\mathbf F(\mathbf r(u,v))\cdot(\mathbf r_u\times\mathbf r_v)\,du\,dv}
$$

법선을 뒤집으면 플럭스의 부호가 바뀌지만 스칼라 면적분은 변하지 않는다.

### 계산 예제: 기울어진 평면을 지나는 수직장

$z=1-x-y$의 제1팔분공간 부분을 위쪽으로 향하게 하자. $\mathbf r(x,y)=(x,y,1-x-y)$이고 투영영역은 $x\ge0$, $y\ge0$, $x+y\le1$이다.

$$
\mathbf r_x=(1,0,-1),\quad
\mathbf r_y=(0,1,-1),\quad
\mathbf r_x\times\mathbf r_y=(1,1,1).
$$

균일장 $\mathbf F=(0,0,E_0)$의 플럭스는

$$
\iint_S\mathbf F\cdot d\mathbf S
=\int_0^1\int_0^{1-x}E_0\,dy\,dx=\frac{E_0}{2}.
$$

곡면 자체의 넓이는 $\sqrt3/2$지만 장이 수직으로 보는 투영넓이는 $1/2$이다. 내적이 기울기에 따른 차이를 자동으로 반영한다. 면적벡터를 사용한 뒤 $\sqrt3$을 또 곱하면 면적 배율을 중복 계산한다.

## 19. Stokes 정리: Curl을 면 전체에 더하기

{% include vector-calculus/boundaries.html %}
*그림 7. Stokes 정리는 열린 곡면과 그 경계를 연결한다. 발산정리는 닫힌 곡면과 그 안의 부피를 연결한다. 위쪽 법선의 경계는 위에서 보아 반시계방향이다.*

$S$가 방향을 정할 수 있는 조각별로 매끄러운 곡면이고 장이 근방에서 $C^1$이면

$$
\boxed{\oint_{\partial S}\mathbf F\cdot d\mathbf r
=\iint_S(\nabla\times\mathbf F)\cdot\mathbf n\,dS}
$$

이다. 평면의 Green 정리를 공간의 곡면으로 확장한 것이다. 경계가 같고 방향이 일치한다면, 장이 매끄럽게 정의된 범위에서 **계산하기 쉬운 곡면으로 바꿀 수 있다.**

### 계산 예제: 반구 대신 원판 사용하기

$\mathbf F=(-y,x,0)$, 경계가 $x^2+y^2=a^2$, $z=0$인 위쪽 반구를 생각하자. 경계방향은 위에서 볼 때 반시계다. Curl이 $(0,0,2)$이므로 위쪽 원판으로 바꾸면

$$
\iint_S(\nabla\times\mathbf F)\cdot d\mathbf S
=\iint_{x^2+y^2\le a^2}2\,dA=2\pi a^2.
$$

반구의 넓이 $2\pi a^2$에 Curl의 크기 $2$를 바로 곱하면 틀린다. 반구에서는 법선이 위치마다 달라 내적이 필요하다.

## 20. 삼중적분과 좌표 선택

영역을 $\Omega$로 쓰면 스칼라 전위 $V$와 혼동을 피할 수 있다. 체적전하밀도 $\rho_v$의 총전하는

$$
Q=\iiint_\Omega\rho_v\,dV
$$

이다. 좌표를 바꾸면 함수뿐 아니라 영역과 체적요소도 함께 바꾼다.

| 좌표 | 정의·각도 범위 | 체적요소 | 적합한 대칭 |
|---|---|---|---|
| 직교 | $(x,y,z)$ | $dx\,dy\,dz$ | 상자·평면 |
| 원통 | $x=r\cos\phi$, $y=r\sin\phi$ | $r\,dr\,d\phi\,dz$ | 직선전하·원통 |
| 구면 | $x=r\sin\theta\cos\phi$, $y=r\sin\theta\sin\phi$, $z=r\cos\theta$ | $r^2\sin\theta\,dr\,d\theta\,d\phi$ | 점전하·구 |

구면좌표의 $\theta$는 **양의 $z$축으로부터 잰 극각**이며 $0\le\theta\le\pi$, 방위각은 $0\le\phi<2\pi$이다. 책에 따라 각도 이름이 바뀌므로 정의를 먼저 확인한다. 일반 좌표변환의 체적 배율은 $\lvert\det(\partial(x,y,z)/\partial(u,v,w))\rvert$이다.

### 계산 예제: 전하밀도가 바깥으로 증가하는 구

반지름 $a>0$인 구 안에서 $\rho_v(r)=\rho_0r/a$이면

$$
\begin{aligned}
Q&=\int_0^{2\pi}\int_0^\pi\int_0^a
\frac{\rho_0r}{a}r^2\sin\theta\,dr\,d\theta\,d\phi\\
&=\frac{\rho_0}{a}\cdot\frac{a^4}{4}\cdot2\cdot2\pi
=\pi\rho_0a^3.
\end{aligned}
$$

균일밀도라면 $Q=4\pi\rho_0a^3/3$이다. 같은 경계밀도 $\rho_0$일 때 내부밀도가 더 낮은 첫 번째 구의 총전하가 더 작다는 점으로 검산할 수 있다.

## 21. 발산정리: 닫힌 면과 내부 부피 연결

$\Omega$가 조각별로 매끄러운 닫힌 경계를 가지며 $\mathbf F$가 그 영역을 포함한 근방에서 $C^1$이면

$$
\boxed{\iint_{\partial\Omega}\mathbf F\cdot\mathbf n\,dS
=\iiint_\Omega\nabla\cdot\mathbf F\,dV}
$$

이다. 여기서 법선은 반드시 **바깥쪽**이다. 작은 상자들을 합치면 내부 공유 면의 플럭스가 상쇄되어 외부 표면만 남는다. 앞의 작은 상자로 정의한 발산을 큰 영역으로 확장한 셈이다. 닫힌 면임을 강조하는 별도 적분기호 대신 $\partial\Omega$를 써서 경계면이라는 사실을 명시했다.

### 계산 예제: 구면 플럭스의 두 계산

$\mathbf F=(x,y,z)$, 반지름 $a$인 구면에서 $\mathbf F=a\mathbf n$이다. 직접 계산하면

$$
\iint_{\partial\Omega}\mathbf F\cdot\mathbf n\,dS
=a(4\pi a^2)=4\pi a^3.
$$

발산정리로 계산하면

$$
\iiint_\Omega3\,dV=3\left(\frac43\pi a^3\right)=4\pi a^3.
$$

### 특이점이 있는 점전하의 주의점

점전하의 장은 원점 밖에서

$$
\mathbf D=\frac{q}{4\pi r^2}\mathbf e_r
$$

이고 발산은 0이다. 하지만 원점을 둘러싼 구면 플럭스는 $q$이다. 원점에서 장이 발산하므로 그 점을 포함한 구 전체에 매끄러운 장의 발산정리를 그대로 적용하면 안 된다. 작은 구를 도려낸 껍질에 적용하면 바깥면과 안쪽면 플럭스가 상쇄된다. 점전하 자체는 분포의 의미에서 전하밀도로 표현한다.

## 22. Laplacian과 Maxwell 방정식으로 연결하기

### Gradient를 다시 발산시키기

스칼라장의 Laplacian은

$$
\nabla^2V=\nabla\cdot(\nabla V)
=\frac{\partial^2V}{\partial x^2}
+\frac{\partial^2V}{\partial y^2}
+\frac{\partial^2V}{\partial z^2}
$$

이다. 전위의 2차 공간 변화를 합친 스칼라다. 일정한 유전율 $\varepsilon$의 정전기장에서 $\mathbf D=\varepsilon\mathbf E$, $\mathbf E=-\nabla V$를 Gauss 법칙에 넣으면

$$
\boxed{\nabla^2V=-\frac{\rho_v}{\varepsilon}}
$$

라는 Poisson 방정식을 얻는다. 전하가 없는 영역에서는 $\nabla^2V=0$인 Laplace 방정식이 된다. 유전율이 공간에 따라 변하면 $\nabla\cdot(\varepsilon\nabla V)=-\rho_v$를 사용해야 한다.

충분히 매끄러운 장에는 두 항등식이 성립한다.

$$
\nabla\times(\nabla f)=\mathbf0,
\qquad \nabla\cdot(\nabla\times\mathbf F)=0.
$$

혼합 편미분들이 서로 상쇄되기 때문이다. 첫 번째는 보존장의 Curl이 0임을, 두 번째는 Curl로 만들어진 장의 발산이 0임을 보여준다.

### 적분형과 미분형이 연결되는 과정

Gauss 법칙에 발산정리를 적용하면

$$
\iint_{\partial\Omega}\mathbf D\cdot\mathbf n\,dS
=\iiint_\Omega\rho_v\,dV
\quad\Longrightarrow\quad
\nabla\cdot\mathbf D=\rho_v.
$$

**시간에 따라 움직이지 않는 경로와 곡면**에 대한 Faraday 법칙에 Stokes 정리를 적용하면

$$
\begin{aligned}
\oint_{\partial S}\mathbf E\cdot d\mathbf l
&=-\frac{d}{dt}\iint_S\mathbf B\cdot\mathbf n\,dS,\\
\nabla\times\mathbf E&=-\frac{\partial\mathbf B}{\partial t}.
\end{aligned}
$$

고정 곡면이므로 적분 안으로 시간미분을 옮길 수 있다. 이동하는 회로에는 운동에 의한 기전력도 고려해야 한다.

나머지 Maxwell 방정식은

$$
\nabla\cdot\mathbf B=0,
\qquad
\nabla\times\mathbf H=\mathbf J+\frac{\partial\mathbf D}{\partial t}.
$$

두 번째 식에 발산을 취하면 $\nabla\cdot(\nabla\times\mathbf H)=0$이므로

$$
\boxed{\nabla\cdot\mathbf J+\frac{\partial\rho_v}{\partial t}=0}
$$

을 얻는다. 밖으로 전류가 나가면 내부 전하가 줄어야 한다는 **전하 보존식**이다. 이렇게 미분 연산과 적분 정리는 같은 현상을 점·경계·영역의 서로 다른 관점에서 설명한다.

## 23. 어떤 연산과 정리를 선택할까?

| 알고 싶은 양 | 선택 | 확인할 조건 |
|---|---|---|
| 스칼라값이 가장 빨리 변하는 방향 | Gradient | 미분 가능성, 영벡터 여부 |
| 특정 방향의 변화율 | 방향도함수 | 방향벡터 정규화 |
| 한 점의 순유출 경향 | Divergence | 성분과 좌표계 |
| 한 점의 순환 경향 | Curl | 회전축과 오른손 방향 |
| 경로를 따라 한 일 | 벡터 선적분 | 경로의 매개변수와 방향 |
| 평면 폐곡선의 순환 | Green | 내부 매끄러움, 양의 경계방향 |
| 공간 폐곡선의 순환 | Stokes | 경계·법선 일치, 곡면 위 특이점 |
| 닫힌 면을 지나는 총 플럭스 | 발산정리 | 닫힘, 바깥 법선, 내부 특이점 |
| 질량·전하의 총량 | 스칼라 중적분 | 밀도, 영역, Jacobian |

공식을 고르기 전에 **대상이 곡선인지 면인지 부피인지**, **장과 접선의 내적인지 법선의 내적인지**를 먼저 판단한다. 계산한 다음에는 방향을 뒤집었을 때의 부호, 대칭성, 단위로 검산한다.

## 24. 연습문제와 해설

### 문제 1. Gradient와 접평면

$f=x^2+y^2+z^2$의 $P=(1,2,2)$에서 $\mathbf a=(2,-1,2)$ 방향의 방향도함수와 등위면의 접평면을 구하자.

**해설.** $\nabla f(P)=(2,4,4)$, $\lVert\mathbf a\rVert=3$이므로 방향도함수는 $(4-4+8)/3=8/3$이다. 접평면은 $2(x-1)+4(y-2)+4(z-2)=0$, 즉 $x+2y+2z=9$이다.

### 문제 2. 발산과 Curl은 독립적인가?

$\mathbf F=(x-y,x+y,2z)$의 발산과 Curl을 구하자.

**해설.** 발산은 $1+1+2=4$이고 Curl은 $(0,0,1-(-1))=(0,0,2)$이다. 이 장에는 순유출과 순환이 동시에 있다. 발산과 Curl은 둘 중 하나만 존재하는 선택지가 아니다.

### 문제 3. 면적분을 발산정리로 바꾸기

문제 2의 장이 단위구 바깥으로 내보내는 총 플럭스를 구하자.

**해설.** 장은 구 전체에서 매끄럽다. 발산이 $4$이므로 총 플럭스는 $4(4\pi/3)=16\pi/3$이다. Curl의 값은 이 계산에 필요하지 않다.

### 문제 4. 방향을 바꾸면 어떻게 되는가?

$\mathbf F=(-y,x,0)$를 반지름 2인 원을 따라 위에서 보아 시계방향으로 적분하자.

**해설.** 반시계방향 순환은 $2\pi(2^2)=8\pi$이다. 시계방향은 부호를 바꿔 $-8\pi$이다. Stokes를 사용할 때도 법선을 아래쪽으로 골라야 같은 결과가 나온다.

### 문제 5. 체적요소를 빠뜨리지 않았는가?

반지름 $a$, 높이 $h$의 원통에서 $\rho_v=kr$일 때 총전하를 구하자.

**해설.** 원통좌표의 체적요소에도 $r$이 있으므로

$$
Q=\int_0^h\int_0^{2\pi}\int_0^a kr\cdot r\,dr\,d\phi\,dz
=\frac{2\pi kha^3}{3}.
$$

밀도의 $r$과 Jacobian의 $r$은 서로 다른 이유로 등장한다.

## 25. 선형대수에서 장의 해석까지

선형대수는 벡터를 기저방향으로 분해하고 행렬로 변환한다. 벡터 미적분에서는 같은 내적·외적을 공간의 각 점에서 사용하고, 그 변화를 미분하거나 영역 전체에 걸쳐 적분한다.

- **정사영 → 방향도함수·선적분:** 원하는 방향의 성분을 고른다.
- **행렬식 → Jacobian·면적벡터:** 좌표변환이 면적과 부피를 얼마나 바꾸는지 계산한다.
- **국소 미분 → 경계 적분:** 발산정리와 Stokes 정리로 점의 성질을 전체 영역의 양과 연결한다.
- **전위 → 전기장 → 전하밀도:** Gradient와 Divergence를 연속해서 적용하면 Poisson 방정식이 나온다.

이 연결을 이해하면 공식을 따로 외우기보다, 문제의 기하학과 물리량에서 필요한 연산을 선택할 수 있다.
