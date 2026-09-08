---
layout: single
title: "Orthogonal Functions and Fourier Series"
categories: Math
tags: Math
toc: true
author_profile: false
comments: true
---

# 직교함수와 푸리에 급수

이번 단원은 공업수학에서 **신호와 시스템으로 넘어가는 핵심 연결고리**다.

앞에서는 미분방정식을 풀어서 시간에 따른 해를 구했다면, 이제부터는 하나의 함수를

$$
\boxed{
\text{여러 개의 기본 함수 성분으로 분해한다}
}
$$

는 관점을 배운다.

특히 주기함수는

$$
1,\quad \cos x,\quad \sin x,\quad \cos 2x,\quad \sin 2x,\quad \cdots
$$

같은 삼각함수들의 합으로 표현할 수 있다.

이것이 **푸리에 급수(Fourier series)** 다.

전자공학에서는 이 개념이

- 주기 신호 분석
- 주파수 성분 분해
- 필터
- 통신
- 신호처리
- 회로의 주파수응답

으로 바로 연결된다.

---

# 이 단원을 왜 배우는가?

예를 들어 다음과 같은 구형파를 생각하자.

$$
f(t)=
\begin{cases}
1, & 0<t<\pi\\
-1, & -\pi<t<0
\end{cases}
$$

이 함수는 모양만 보면 삼각함수와 전혀 닮지 않았다.

그런데 실제로는

$$
f(t)
=
\frac{4}{\pi}
\left(
\sin t
+
\frac{1}{3}\sin 3t
+
\frac{1}{5}\sin 5t
+
\cdots
\right)
$$

처럼 여러 사인파의 합으로 표현할 수 있다.

즉 복잡해 보이는 파형도

$$
\boxed{
\text{기본 주파수 성분들의 합}
}
$$

으로 볼 수 있다.

신호와 시스템에서는 이것을 아주 중요하게 사용한다.

---

# 1. 함수도 벡터처럼 생각할 수 있다

우리는 벡터에서

$$
\mathbf{a}\cdot\mathbf{b}=0
$$

이면 두 벡터가 서로 직교한다고 배웠다.

예를 들어

$$
\mathbf{a}
=
\begin{bmatrix}
1\\
0
\end{bmatrix},
\qquad
\mathbf{b}
=
\begin{bmatrix}
0\\
1
\end{bmatrix}
$$

이면

$$
\mathbf{a}\cdot\mathbf{b}=0
$$

이므로 서로 직교한다.

푸리에 급수에서는 이 생각을 **함수**까지 확장한다.

---

# 2. 함수의 내적

두 함수 $f(x)$와 $g(x)$의 내적을 구간 $[a,b]$에서

$$
\boxed{
\langle f,g\rangle
=
\int_a^b f(x)g(x)\,dx
}
$$

로 정의한다.

벡터의 내적

$$
\mathbf{a}\cdot\mathbf{b}
$$

와 같은 역할을 한다.

---

## 2.1 직교함수

두 함수 $f(x)$와 $g(x)$가

$$
\boxed{
\int_a^b f(x)g(x)\,dx=0
}
$$

을 만족하면 두 함수를 **직교(orthogonal)** 한다고 한다.

---

## 예제 1. $\sin x$와 $\cos x$의 직교성

구간 $[-\pi,\pi]$에서

$$
\int_{-\pi}^{\pi}\sin x\cos x\,dx
$$

를 계산하자.

삼각함수 공식

$$
\sin x\cos x
=
\frac{1}{2}\sin 2x
$$

를 사용하면

$$
\int_{-\pi}^{\pi}\sin x\cos x\,dx
=
\frac{1}{2}
\int_{-\pi}^{\pi}\sin 2x\,dx
$$

이다.

$\sin 2x$는 홀함수이므로 대칭구간에서 적분값은 0이다.

따라서

$$
\boxed{
\int_{-\pi}^{\pi}\sin x\cos x\,dx=0
}
$$

이다.

즉

$$
\sin x
\quad\text{와}\quad
\cos x
$$

는 $[-\pi,\pi]$에서 서로 직교한다.

---

# 3. 삼각함수의 직교성

푸리에 급수가 가능한 이유는 삼각함수들이 서로 직교하기 때문이다.

정수 $m,n$에 대해 다음이 성립한다.

---

## 3.1 코사인끼리

$$
\boxed{
\int_{-\pi}^{\pi}
\cos mx\cos nx\,dx
=
\begin{cases}
0, & m\ne n\\
\pi, & m=n\ne0
\end{cases}
}
$$

---

## 3.2 사인끼리

$$
\boxed{
\int_{-\pi}^{\pi}
\sin mx\sin nx\,dx
=
\begin{cases}
0, & m\ne n\\
\pi, & m=n
\end{cases}
}
$$

---

## 3.3 사인과 코사인

$$
\boxed{
\int_{-\pi}^{\pi}
\sin mx\cos nx\,dx=0
}
$$

이다.

이 성질 때문에 서로 다른 주파수 성분을 하나씩 분리해서 꺼낼 수 있다.

---

# 4. 왜 직교성이 중요한가?

벡터를 생각해보자.

어떤 벡터가

$$
\mathbf{v}
=
3\mathbf{e}_1
+
2\mathbf{e}_2
$$

라고 하자.

여기서 $\mathbf{e}_1,\mathbf{e}_2$가 직교하면 내적을 이용해서 각각의 성분을 쉽게 구할 수 있다.

함수도 마찬가지다.

$$
f(x)
=
a_0
+
a_1\cos x
+
b_1\sin x
+
a_2\cos2x
+
b_2\sin2x
+\cdots
$$

처럼 표현된 함수에서 특정 $\cos nx$ 성분을 구하고 싶으면 양변에 $\cos nx$를 곱해서 적분하면 된다.

다른 주파수 성분은 직교성 때문에 전부 사라진다.

이것이 푸리에 계수 계산의 핵심이다.

---

# 5. 함수의 크기와 정규직교

벡터의 크기가

$$
\|\mathbf{v}\|
=
\sqrt{\mathbf{v}\cdot\mathbf{v}}
$$

인 것처럼 함수의 크기도

$$
\boxed{
\|f\|
=
\sqrt{
\int_a^b |f(x)|^2\,dx
}
}
$$

로 정의할 수 있다.

---

## 5.1 정규직교 함수

두 함수가 서로 직교하면서 각각의 크기가 1이면 **정규직교(orthonormal)** 라고 한다.

즉

$$
\langle \phi_m,\phi_n\rangle
=
\begin{cases}
1,&m=n\\
0,&m\ne n
\end{cases}
$$

이다.

이를 크로네커 델타를 이용하면

$$
\boxed{
\langle \phi_m,\phi_n\rangle=\delta_{mn}
}
$$

이라고 쓸 수 있다.

---

# 6. 푸리에 급수의 기본 형태

주기 $2\pi$인 함수 $f(x)$를 생각하자.

푸리에 급수는 다음과 같은 형태다.

$$
\boxed{
f(x)
\sim
\frac{a_0}{2}
+
\sum_{n=1}^{\infty}
\left(
a_n\cos nx
+
b_n\sin nx
\right)
}
$$

즉

$$
f(x)
\sim
\frac{a_0}{2}
+
a_1\cos x+b_1\sin x
+
a_2\cos2x+b_2\sin2x
+\cdots
$$

이다.

---

# 7. 푸리에 계수

각 계수는 다음과 같이 구한다.

$$
\boxed{
a_0
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
f(x)\,dx
}
$$

$$
\boxed{
a_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
f(x)\cos nx\,dx
}
$$

$$
\boxed{
b_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
f(x)\sin nx\,dx
}
$$

이다.

---

# 8. 왜 $a_n$ 공식이 이렇게 나오는가?

푸리에 급수를

$$
f(x)
=
\frac{a_0}{2}
+
\sum_{n=1}^{\infty}
\left(
a_n\cos nx+b_n\sin nx
\right)
$$

라고 하자.

특정 $a_m$을 구하고 싶다고 하자.

양변에

$$
\cos mx
$$

를 곱한다.

그러면

$$
f(x)\cos mx
=
\frac{a_0}{2}\cos mx
+
\sum_{n=1}^{\infty}
a_n\cos nx\cos mx
+
\sum_{n=1}^{\infty}
b_n\sin nx\cos mx
$$

이다.

이 식을 $[-\pi,\pi]$에서 적분한다.

직교성에 의해

$$
\int_{-\pi}^{\pi}\cos nx\cos mx\,dx
$$

는 $n=m$일 때만 살아남는다.

또

$$
\int_{-\pi}^{\pi}\sin nx\cos mx\,dx=0
$$

이다.

따라서

$$
\int_{-\pi}^{\pi}f(x)\cos mx\,dx
=
a_m\pi
$$

가 되고,

$$
\boxed{
a_m
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
f(x)\cos mx\,dx
}
$$

가 된다.

즉 푸리에 계수 공식은 외워야 하는 갑작스러운 공식이 아니라 **직교성에서 자연스럽게 나온다.**

---

# 9. $a_0$의 의미

푸리에 급수에서

$$
\frac{a_0}{2}
$$

는 함수의 **평균값(DC 성분)** 을 나타낸다.

실제로 함수의 평균값은

$$
\frac{1}{2\pi}
\int_{-\pi}^{\pi}f(x)\,dx
$$

인데,

$$
a_0
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}f(x)\,dx
$$

이므로

$$
\boxed{
\frac{a_0}{2}
=
\frac{1}{2\pi}
\int_{-\pi}^{\pi}f(x)\,dx
}
$$

이다.

전자공학에서는 이것을 **DC 성분**이라고 볼 수 있다.

---

# 10. 주파수 성분의 의미

푸리에 급수

$$
f(t)
=
\frac{a_0}{2}
+
a_1\cos\omega_0t
+
b_1\sin\omega_0t
+
a_2\cos2\omega_0t
+
b_2\sin2\omega_0t
+\cdots
$$

에서

$$
\omega_0
$$

를 **기본 각주파수(fundamental angular frequency)** 라고 한다.

그리고

$$
2\omega_0,\quad
3\omega_0,\quad
4\omega_0,\quad\cdots
$$

는 **고조파(harmonics)** 라고 한다.

---

# 11. 일반 주기 $T$인 함수의 푸리에 급수

지금까지는 주기가 $2\pi$라고 가정했다.

하지만 실제 신호는 주기가 $T$인 경우가 많다.

기본 각주파수는

$$
\boxed{
\omega_0=\frac{2\pi}{T}
}
$$

이다.

따라서 일반적인 푸리에 급수는

$$
\boxed{
f(t)
=
\frac{a_0}{2}
+
\sum_{n=1}^{\infty}
\left[
a_n\cos(n\omega_0t)
+
b_n\sin(n\omega_0t)
\right]
}
$$

이다.

계수는

$$
\boxed{
a_0
=
\frac{2}{T}
\int_{t_0}^{t_0+T}
f(t)\,dt
}
$$

$$
\boxed{
a_n
=
\frac{2}{T}
\int_{t_0}^{t_0+T}
f(t)\cos(n\omega_0t)\,dt
}
$$

$$
\boxed{
b_n
=
\frac{2}{T}
\int_{t_0}^{t_0+T}
f(t)\sin(n\omega_0t)\,dt
}
$$

이다.

주기 하나만 정확히 적분하면 된다.

---

# 12. 예제 2: 상수함수의 푸리에 급수

다음 함수를 생각하자.

$$
f(x)=3
$$

주기는 $2\pi$라고 하자.

먼저

$$
a_0
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}3\,dx
$$

이므로

$$
a_0
=
\frac{1}{\pi}(6\pi)=6
$$

이다.

따라서

$$
\frac{a_0}{2}=3
$$

이다.

한편 $n\ge1$에 대해

$$
a_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
3\cos nx\,dx=0
$$

이고

$$
b_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
3\sin nx\,dx=0
$$

이다.

따라서

$$
\boxed{
f(x)=3
}
$$

그 자체가 푸리에 급수다.

---

# 13. 예제 3: $f(x)=x$

구간

$$
-\pi<x<\pi
$$

에서

$$
f(x)=x
$$

이고 이를 주기적으로 연장한다고 하자.

---

## 13.1 $a_0$

$$
a_0
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}x\,dx
$$

이다.

$x$는 홀함수이므로

$$
\boxed{
a_0=0
}
$$

이다.

---

## 13.2 $a_n$

$$
a_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
x\cos nx\,dx
$$

이다.

$x$는 홀함수이고 $\cos nx$는 짝함수이므로 곱은 홀함수다.

따라서

$$
\boxed{
a_n=0
}
$$

이다.

---

## 13.3 $b_n$

$$
b_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
x\sin nx\,dx
$$

이다.

$x$와 $\sin nx$가 둘 다 홀함수이므로 곱은 짝함수다.

따라서

$$
b_n
=
\frac{2}{\pi}
\int_0^\pi
x\sin nx\,dx
$$

이다.

부분적분을 사용하자.

$$
u=x,
\qquad
dv=\sin nx\,dx
$$

이면

$$
du=dx,
\qquad
v=-\frac{\cos nx}{n}
$$

이다.

따라서

$$
\int x\sin nx\,dx
=
-\frac{x\cos nx}{n}
+
\frac{1}{n}
\int\cos nx\,dx
$$

이고

$$
=
-\frac{x\cos nx}{n}
+
\frac{\sin nx}{n^2}
$$

이다.

$0$부터 $\pi$까지 대입하면

$$
\int_0^\pi x\sin nx\,dx
=
-\frac{\pi\cos n\pi}{n}
$$

이다.

$$
\cos n\pi=(-1)^n
$$

이므로

$$
\int_0^\pi x\sin nx\,dx
=
-\frac{\pi(-1)^n}{n}
$$

이다.

따라서

$$
b_n
=
\frac{2}{\pi}
\left(
-\frac{\pi(-1)^n}{n}
\right)
$$

즉

$$
\boxed{
b_n
=
\frac{2(-1)^{n+1}}{n}
}
$$

이다.

---

## 13.4 최종 푸리에 급수

따라서

$$
\boxed{
x
=
2
\sum_{n=1}^{\infty}
\frac{(-1)^{n+1}}{n}
\sin nx
}
$$

이다.

앞의 몇 항만 쓰면

$$
\boxed{
x
=
2
\left(
\sin x
-
\frac{1}{2}\sin2x
+
\frac{1}{3}\sin3x
-
\frac{1}{4}\sin4x
+\cdots
\right)
}
$$

이다.

---

# 14. 짝함수와 홀함수

푸리에 급수 계산에서 대칭성을 이용하면 적분량을 크게 줄일 수 있다.

---

## 14.1 짝함수

$$
f(-x)=f(x)
$$

이면 짝함수다.

예:

$$
x^2,\quad
\cos x,\quad
|x|
$$

---

## 14.2 홀함수

$$
f(-x)=-f(x)
$$

이면 홀함수다.

예:

$$
x,\quad
x^3,\quad
\sin x
$$

---

# 15. 짝함수의 푸리에 급수

$f(x)$가 짝함수이면

$$
f(x)\sin nx
$$

는 홀함수가 된다.

따라서

$$
b_n=0
$$

이다.

즉

$$
\boxed{
f(x)
=
\frac{a_0}{2}
+
\sum_{n=1}^{\infty}
a_n\cos nx
}
$$

만 남는다.

이것이 뒤에서 배우는 **푸리에 코사인 급수**와 연결된다.

---

# 16. 홀함수의 푸리에 급수

$f(x)$가 홀함수이면

$$
a_0=0
$$

이고

$$
a_n=0
$$

이다.

따라서

$$
\boxed{
f(x)
=
\sum_{n=1}^{\infty}
b_n\sin nx
}
$$

만 남는다.

이것이 **푸리에 사인 급수**와 연결된다.

---

# 17. 예제 4: 구형파

다음 주기함수를 생각하자.

$$
f(x)
=
\begin{cases}
-1, & -\pi<x<0\\
1, & 0<x<\pi
\end{cases}
$$

이 함수는 홀함수다.

따라서

$$
a_0=0,
\qquad
a_n=0
$$

이고

$$
b_n
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}
f(x)\sin nx\,dx
$$

만 계산하면 된다.

홀함수 구조를 이용하면

$$
b_n
=
\frac{2}{\pi}
\int_0^\pi
\sin nx\,dx
$$

이다.

적분하면

$$
b_n
=
\frac{2}{\pi}
\left[
-\frac{\cos nx}{n}
\right]_0^\pi
$$

이므로

$$
b_n
=
\frac{2}{n\pi}
\left(
1-\cos n\pi
\right)
$$

이다.

$$
\cos n\pi=(-1)^n
$$

이므로

$$
b_n
=
\frac{2}{n\pi}
\left(
1-(-1)^n
\right)
$$

이다.

$n$이 짝수이면

$$
b_n=0
$$

이고,

$n$이 홀수이면

$$
b_n=\frac{4}{n\pi}
$$

이다.

따라서

$$
\boxed{
f(x)
=
\frac{4}{\pi}
\left(
\sin x
+
\frac{1}{3}\sin3x
+
\frac{1}{5}\sin5x
+
\cdots
\right)
}
$$

이다.

---

# 18. 구형파가 중요한 이유

구형파는 전자공학에서 자주 등장한다.

예를 들어

- 디지털 신호
- 클럭 신호
- PWM
- 스위칭 회로
- 펄스 신호

등은 이상적으로 구형파와 비슷하다.

그런데 구형파를 푸리에 급수로 보면

$$
\boxed{
\text{기본주파수}
+
\text{3차 고조파}
+
\text{5차 고조파}
+\cdots
}
$$

의 합이다.

따라서 어떤 회로나 필터가 특정 고주파 성분을 제거하면 구형파의 모양도 변한다.

이것이 푸리에 급수가 신호와 시스템에서 중요한 이유다.

---

# 19. 부분합

실제로 무한히 많은 항을 계산할 수는 없다.

따라서 보통 앞의 몇 항만 사용한다.

$$
S_N(x)
=
\frac{a_0}{2}
+
\sum_{n=1}^{N}
\left(
a_n\cos nx+b_n\sin nx
\right)
$$

를 **$N$차 부분합(partial sum)** 이라고 한다.

$N$이 커질수록 원래 함수에 가까워진다.

---

# 20. 구형파의 부분합

구형파의 경우

$$
S_N(x)
=
\frac{4}{\pi}
\sum_{k=0}^{N}
\frac{1}{2k+1}
\sin((2k+1)x)
$$

이다.

예를 들어

$$
S_0(x)
=
\frac{4}{\pi}\sin x
$$

이고,

$$
S_1(x)
=
\frac{4}{\pi}
\left(
\sin x
+
\frac{1}{3}\sin3x
\right)
$$

이다.

또

$$
S_2(x)
=
\frac{4}{\pi}
\left(
\sin x
+
\frac{1}{3}\sin3x
+
\frac{1}{5}\sin5x
\right)
$$

이다.

항을 많이 더할수록 구형파 모양에 가까워진다.

---

# 21. 불연속점에서는 어떻게 되는가?

푸리에 급수가 항상 원래 함수값으로 수렴하는 것은 아니다.

함수가 연속인 점에서는 보통

$$
S_N(x)\to f(x)
$$

로 수렴한다.

하지만 점프 불연속점에서는

$$
\boxed{
S_N(x)
\to
\frac{
f(x^-)+f(x^+)
}{2}
}
$$

로 수렴한다.

즉 좌극한과 우극한의 평균값으로 수렴한다.

---

# 22. 예제 5: 구형파의 불연속점

구형파에서 $x=0$에서는

$$
f(0^-)
=
-1
$$

이고

$$
f(0^+)
=
1
$$

이다.

따라서 푸리에 급수는 $x=0$에서

$$
\frac{-1+1}{2}=0
$$

으로 수렴한다.

즉

$$
\boxed{
S_N(0)\to0
}
$$

이다.

---

# 23. 깁스 현상

불연속점 근처에서는 푸리에 부분합이 함수값을 약간 넘어서는 진동을 보인다.

이를 **깁스 현상(Gibbs phenomenon)** 이라고 한다.

항의 개수를 늘리면 진동하는 영역은 점점 좁아지지만, 최대 오버슈트 비율은 완전히 사라지지 않는다.

이 현상은 실제 신호처리에서도 중요하다.

---

# 24. 푸리에 급수를 벡터 관점에서 보기

푸리에 급수를 이해하는 가장 좋은 방법 중 하나는 함수공간의 벡터분해로 보는 것이다.

벡터

$$
\mathbf{v}
=
c_1\mathbf{e}_1
+
c_2\mathbf{e}_2
+
c_3\mathbf{e}_3
$$

와 비슷하게

$$
f(x)
=
\frac{a_0}{2}
+
a_1\cos x+b_1\sin x
+
a_2\cos2x+b_2\sin2x
+\cdots
$$

로 표현한다.

즉

$$
\boxed{
\text{함수}
=
\text{직교 기저 함수들의 선형결합}
}
$$

이다.

---

# 25. 푸리에 계수는 투영이다

벡터에서

$$
c_n
=
\frac{
\mathbf{v}\cdot\mathbf{e}_n
}{
\mathbf{e}_n\cdot\mathbf{e}_n
}
$$

처럼 특정 방향의 성분을 구한다.

함수에서도

$$
\boxed{
c_n
=
\frac{
\langle f,\phi_n\rangle
}{
\langle \phi_n,\phi_n\rangle
}
}
$$

꼴로 특정 직교함수 방향의 성분을 구한다.

푸리에 계수는 바로 이 **투영(projection)** 의 결과다.

---

# 26. 전자공학 관점: 시간영역과 주파수영역

시간영역에서는 신호를

$$
x(t)
$$

로 본다.

푸리에 관점에서는 같은 신호를 여러 주파수 성분의 합으로 본다.

즉

$$
\boxed{
x(t)
\longleftrightarrow
\text{주파수 성분}
}
$$

이다.

예를 들어

$$
x(t)
=
3
+
2\cos100t
+
\sin300t
$$

이면 이 신호에는

- DC 성분: $3$
- 각주파수 $100$: 진폭 $2$
- 각주파수 $300$: 사인 성분

이 존재한다고 볼 수 있다.

---

# 27. 시스템은 주파수마다 다르게 반응한다

전자회로와 시스템은 모든 주파수에 동일하게 반응하지 않는다.

예를 들어 저역통과필터는

- 낮은 주파수는 통과
- 높은 주파수는 감쇠

시킨다.

따라서 입력신호를 푸리에 급수로

$$
x(t)
=
\sum_n
\text{주파수 성분}
$$

으로 분해하면 시스템의 출력을 각 주파수별로 분석할 수 있다.

이 관점이 뒤에서 배우는

$$
H(j\omega)
$$

라는 **주파수응답**으로 연결된다.

---

# 28. 푸리에 급수와 필터

구형파 입력을 생각하자.

$$
x(t)
=
\frac{4}{\pi}
\left(
\sin\omega_0t
+
\frac13\sin3\omega_0t
+
\frac15\sin5\omega_0t
+\cdots
\right)
$$

저역통과필터가 고주파 성분을 제거하면

$$
3\omega_0,\quad
5\omega_0,\quad
7\omega_0,\cdots
$$

성분이 줄어든다.

출력은 점점

$$
\sin\omega_0t
$$

에 가까운 부드러운 파형이 된다.

즉 필터가 파형을 바꾸는 이유를 푸리에 급수로 설명할 수 있다.

---

# 29. Parseval 관계 미리보기

푸리에 계수는 신호의 에너지와도 연결된다.

대표적으로 $2\pi$ 주기 함수에 대해

$$
\boxed{
\frac{1}{\pi}
\int_{-\pi}^{\pi}
|f(x)|^2\,dx
=
\frac{a_0^2}{2}
+
\sum_{n=1}^{\infty}
\left(
a_n^2+b_n^2
\right)
}
$$

라는 관계가 있다.

이를 **Parseval의 등식**이라고 한다.

즉 시간영역의 전체 크기와 주파수 성분들의 크기가 서로 연결된다.

신호처리에서는 아주 중요한 생각이다.

---

# 30. 예제 6: 간단한 주기 신호

다음 함수를 생각하자.

$$
f(x)=
\begin{cases}
0,&-\pi<x<0\\
1,&0<x<\pi
\end{cases}
$$

---

## 30.1 $a_0$

$$
a_0
=
\frac{1}{\pi}
\int_{-\pi}^{\pi}f(x)\,dx
$$

이므로

$$
a_0
=
\frac{1}{\pi}
\int_0^\pi1\,dx
=1
$$

이다.

따라서 DC 성분은

$$
\frac{a_0}{2}
=
\frac12
$$

이다.

---

## 30.2 $a_n$

$$
a_n
=
\frac{1}{\pi}
\int_0^\pi\cos nx\,dx
$$

이고,

$$
a_n
=
\frac{1}{n\pi}
\left[
\sin nx
\right]_0^\pi
=0
$$

이다.

---

## 30.3 $b_n$

$$
b_n
=
\frac{1}{\pi}
\int_0^\pi
\sin nx\,dx
$$

이므로

$$
b_n
=
\frac{1}{n\pi}
\left(
1-(-1)^n
\right)
$$

이다.

따라서

$$
b_n
=
\begin{cases}
0,&n\text{ 짝수}\\
\dfrac{2}{n\pi},&n\text{ 홀수}
\end{cases}
$$

이다.

최종적으로

$$
\boxed{
f(x)
=
\frac12
+
\frac{2}{\pi}
\left(
\sin x
+
\frac13\sin3x
+
\frac15\sin5x
+\cdots
\right)
}
$$

이다.

---

# 31. 푸리에 급수 문제 풀이 순서

푸리에 급수 문제는 다음 순서로 풀면 된다.

## 1단계: 주기 확인

$$
T
$$

또는

$$
2L
$$

을 확인한다.

## 2단계: 대칭성 확인

- 짝함수인가?
- 홀함수인가?
- 둘 다 아닌가?

를 먼저 본다.

## 3단계: $a_0$ 계산

평균값 성분을 구한다.

## 4단계: $a_n$ 계산

코사인 성분을 구한다.

## 5단계: $b_n$ 계산

사인 성분을 구한다.

## 6단계: 급수 작성

계수 패턴을 정리한다.

## 7단계: 필요하면 부분합 또는 수렴값 확인

---

# 32. 일반 구간 $[-L,L]$

주기가

$$
2L
$$

인 함수에서는 푸리에 급수가

$$
\boxed{
f(x)
=
\frac{a_0}{2}
+
\sum_{n=1}^{\infty}
\left[
a_n
\cos\left(\frac{n\pi x}{L}\right)
+
b_n
\sin\left(\frac{n\pi x}{L}\right)
\right]
}
$$

로 바뀐다.

계수는

$$
\boxed{
a_0
=
\frac{1}{L}
\int_{-L}^{L}
f(x)\,dx
}
$$

$$
\boxed{
a_n
=
\frac{1}{L}
\int_{-L}^{L}
f(x)
\cos\left(\frac{n\pi x}{L}\right)
dx
}
$$

$$
\boxed{
b_n
=
\frac{1}{L}
\int_{-L}^{L}
f(x)
\sin\left(\frac{n\pi x}{L}\right)
dx
}
$$

이다.

이 형태가 실제 공업수학 문제에서 매우 자주 나온다.

---

# 33. 예제 7: 주기가 $2L$인 함수

$$
f(x)=x,
\qquad
-L<x<L
$$

을 생각하자.

$f(x)=x$는 홀함수이므로

$$
a_0=0,
\qquad
a_n=0
$$

이다.

따라서

$$
b_n
=
\frac{1}{L}
\int_{-L}^{L}
x
\sin\left(
\frac{n\pi x}{L}
\right)dx
$$

만 계산하면 된다.

적분 결과는

$$
\boxed{
b_n
=
\frac{2L}{n\pi}
(-1)^{n+1}
}
$$

이다.

따라서

$$
\boxed{
x
=
\frac{2L}{\pi}
\sum_{n=1}^{\infty}
\frac{(-1)^{n+1}}{n}
\sin\left(
\frac{n\pi x}{L}
\right)
}
$$

이다.

$L=\pi$를 넣으면 앞에서 구한 $f(x)=x$의 결과가 그대로 나온다.

---

# 34. 자주 헷갈리는 포인트

## 34.1 왜 $a_0/2$인가?

$a_0$의 정의를 다른 계수와 비슷하게 맞추기 위해 그렇게 쓴다.

실제 평균값은

$$
\frac{a_0}{2}
$$

이다.

---

## 34.2 왜 다른 주파수 항이 적분하면 사라지는가?

삼각함수의 직교성 때문이다.

$$
\int_{-\pi}^{\pi}
\cos mx\cos nx\,dx=0
\qquad(m\ne n)
$$

이다.

---

## 34.3 푸리에 급수는 함수와 완전히 같은가?

조건에 따라 거의 모든 점에서 같지만 불연속점에서는 좌우 극한의 평균값으로 수렴한다.

---

## 34.4 항을 많이 더하면 항상 정확해지는가?

대부분의 구간에서는 더 정확해진다.

다만 불연속점 근처에서는 Gibbs 현상이 나타난다.

---

## 34.5 왜 신호처리에서 푸리에가 중요한가?

복잡한 신호를 주파수 성분별로 나누면 시스템이 각 주파수를 어떻게 처리하는지 쉽게 분석할 수 있기 때문이다.

---

# 35. 전자공학 연결 요약

이 단원에서 꼭 기억할 연결은 다음이다.

$$
\boxed{
\text{직교함수}
\rightarrow
\text{주파수 성분 분리}
}
$$

$$
\boxed{
\text{푸리에 계수}
\rightarrow
\text{각 주파수 성분의 크기}
}
$$

$$
\boxed{
\text{푸리에 급수}
\rightarrow
\text{주기신호의 주파수 분해}
}
$$

그리고 이후에는

$$
\boxed{
\text{푸리에 급수}
\rightarrow
\text{푸리에 변환}
\rightarrow
\text{주파수응답}
\rightarrow
\text{필터·통신·신호처리}
}
$$

로 이어진다.

---

# 연습문제

## 문제 1

다음 두 함수가 $[-\pi,\pi]$에서 직교하는지 확인하여라.

$$
f(x)=\sin2x,
\qquad
g(x)=\sin3x
$$

### 풀이

$$
\int_{-\pi}^{\pi}
\sin2x\sin3x\,dx
$$

를 계산한다.

서로 다른 정수 주파수의 사인함수는 직교하므로

$$
\boxed{
\int_{-\pi}^{\pi}
\sin2x\sin3x\,dx=0
}
$$

이다.

따라서 두 함수는 직교한다.

---

## 문제 2

다음 함수의 푸리에 급수를 구하여라.

$$
f(x)=x,
\qquad
-\pi<x<\pi
$$

### 풀이 핵심

$f(x)$는 홀함수이므로

$$
a_0=a_n=0
$$

이다.

또

$$
b_n
=
\frac{2(-1)^{n+1}}{n}
$$

이므로

$$
\boxed{
x
=
2
\left(
\sin x
-\frac12\sin2x
+\frac13\sin3x
-\cdots
\right)
}
$$

이다.

---

## 문제 3

다음 함수의 푸리에 급수에서 어떤 계수들이 0인지 먼저 판단하여라.

$$
f(x)=x^2,
\qquad
-\pi<x<\pi
$$

### 풀이

$x^2$은 짝함수이므로

$$
\boxed{
b_n=0
}
$$

이다.

따라서 코사인 항만 남는다.

---

## 문제 4

다음 주기함수의 평균값을 구하여라.

$$
f(x)
=
\begin{cases}
2,&0<x<\pi\\
0,&-\pi<x<0
\end{cases}
$$

### 풀이

평균값은

$$
\frac{1}{2\pi}
\int_{-\pi}^{\pi}f(x)\,dx
$$

이다.

따라서

$$
\frac{1}{2\pi}
\int_0^\pi2\,dx
=
1
$$

이다.

즉

$$
\boxed{
\frac{a_0}{2}=1
}
$$

이다.

---

## 문제 5

구형파의 푸리에 급수에서 짝수 고조파가 사라지는 이유를 설명하여라.

### 풀이

구형파에 대해

$$
b_n
=
\frac{2}{n\pi}
\left(
1-(-1)^n
\right)
$$

이다.

$n$이 짝수이면

$$
(-1)^n=1
$$

이므로

$$
b_n=0
$$

이 된다.

따라서 홀수 고조파만 남는다.

---

# 직접 풀어볼 추가문제

## 추가문제 1

다음 함수의 푸리에 급수를 구하여라.

$$
f(x)=|x|,
\qquad
-\pi<x<\pi
$$

힌트: 짝함수이므로 $b_n=0$이다.

---

## 추가문제 2

다음 함수를 푸리에 급수로 전개하여라.

$$
f(x)
=
\begin{cases}
0,&-\pi<x<0\\
x,&0<x<\pi
\end{cases}
$$

---

## 추가문제 3

다음 함수의 DC 성분을 구하여라.

$$
f(t)=3+2\cos5t-\sin8t
$$

---

## 추가문제 4

주기가

$$
T=4
$$

인 주기신호의 기본 각주파수 $\omega_0$를 구하여라.

---

## 추가문제 5

푸리에 급수의 항을 많이 더할수록 구형파에 가까워지는데도 불연속점 근처에서 진동이 완전히 없어지지 않는 이유를 설명하여라.

---

# 마지막 핵심 정리

## 핵심 1

함수의 직교는

$$
\boxed{
\int_a^b
f(x)g(x)\,dx=0
}
$$

으로 정의한다.

---

## 핵심 2

삼각함수는 서로 직교하므로 주기함수의 성분을 분리할 수 있다.

---

## 핵심 3

푸리에 급수는

$$
\boxed{
f(x)
=
\frac{a_0}{2}
+
\sum_{n=1}^{\infty}
\left(
a_n\cos nx+b_n\sin nx
\right)
}
$$

형태다.

---

## 핵심 4

푸리에 계수는 함수가 각 삼각함수 방향으로 얼마나 포함되어 있는지를 나타낸다.

즉 함수공간에서의 **투영계수**다.

---

## 핵심 5

짝함수는 코사인 성분만,

홀함수는 사인 성분만 남는다.

---

## 핵심 6

푸리에 급수는 전자공학에서

$$
\boxed{
\text{시간영역 신호}
\rightarrow
\text{주파수 성분}
}
$$

으로 바꾸어 보는 첫 단계다.

이 개념은 이후

$$
\boxed{
\text{푸리에 변환}
\rightarrow
\text{스펙트럼}
\rightarrow
\text{주파수응답}
\rightarrow
\text{필터·통신·신호처리}
}
$$

로 이어진다.
