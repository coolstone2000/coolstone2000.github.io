---
layout: single
title: "Linear System"
categories: Math
tags: Math
toc: true
author_profile: false
comments: true
---

연립선형미분방정식은 처음 보면 식이 갑자기 여러 개가 한꺼번에 묶여 나와서 좀 부담스럽다.

그런데 현실적 관점에서 보면 이 단원은 오히려 굉장히 자연스럽다.

왜냐하면 원래부터 **변수가 하나만 있는 경우보다 여러 개가 동시에 얽혀 있는 경우가 훨씬 많기 때문**이다.

예를 들면

- 회로의 여러 노드 전압

- 여러 루프 전류

- 상태변수 $x_1,x_2,\dots,x_n$

- 전기장과 자기장의 여러 성분

- 기계-전기 결합 시스템의 위치, 속도, 전류, 전압

같은 것들은 한 번에 같이 움직인다.

그래서 하나의 미분방정식

$$
y^{\prime}+2y=0
$$

를 푸는 것보다

$$
\begin{cases}
x_1^{\prime} = a_{11}x_1+a_{12}x_2\\
x_2^{\prime} = a_{21}x_1+a_{22}x_2
\end{cases}
$$

처럼 **서로 연결된 여러 미분방정식**을 동시에 다루는 법을 배우는 것이 훨씬 실전적이다.

이 단원에서 제일 중요한 핵심은 다음이다.

$$
\boxed{
\text{연립선형미분방정식}
\;\longleftrightarrow\;
\text{행렬}
\;\longleftrightarrow\;
\text{고유값}
\;\longleftrightarrow\;
\text{행렬 지수함수}
}
$$

즉 이 단원은 앞에서 배운 **벡터, 행렬, 고유값, 대각화**가 실제 미분방정식에 어떻게 쓰이는지를 보여주는 장이라고 생각하면 된다.

---

## 이 단원을 왜 배우는가?

전자공학에서 연립선형미분방정식은 그냥 수학문제가 아니라 실제 시스템 모델 그 자체다.

예를 들어 상태방정식은 보통

$$
\boxed{
\mathbf{x}^{\prime}(t)=A\mathbf{x}(t)+\mathbf{u}(t)
}
$$

형태로 쓴다.

여기서

- $\mathbf{x}(t)$: 상태벡터

- $A$: 시스템 행렬

- $\mathbf{u}(t)$: 외부 입력

이다.

회로이론에서는 커패시터 전압과 인덕터 전류를 상태변수로 잡고 이런 식을 만들고,

제어공학에서는 시스템의 안정성과 응답을 분석할 때 이 형태를 쓴다.

통신과 신호처리에서는 연속시간 필터나 상태공간 모델이 바로 이 구조를 가진다.

따라서 이 단원은 다음과 같은 질문에 답한다.

1. 서로 연결된 미분방정식을 어떻게 한 번에 정리할까?

2. 해가 시간이 지나면서 감쇠하는지, 발산하는지, 진동하는지는 무엇으로 결정될까?

3. 초기조건이 바뀌면 해가 어떻게 달라질까?

4. 외부 입력이 있으면 해는 어떻게 구할까?

5. $e^{At}$ 라는 것이 왜 자연스럽게 등장할까?

---

## 먼저 한눈에 보는 상호작용 시각화

아래 시각화에서는 2차 동차선형계

$$
\boxed{
\mathbf{x}^{\prime}(t)=A\mathbf{x}(t)
}
$$

를 직접 조작해 볼 수 있다.

위쪽에서는 시스템 행렬

$$
A=
\begin{bmatrix}
a_{11} & a_{12}\\
a_{21} & a_{22}
\end{bmatrix}
$$

과 초기조건

$$
\mathbf{x}(0)
=
\begin{bmatrix}
x_1(0)\\
x_2(0)
\end{bmatrix}
$$

을 바꾼다.

그러면 같은 시스템을 세 가지 관점에서 동시에 볼 수 있다.

1. **고유값 평면**

   - 고유값 $\lambda_1,\lambda_2$의 실수부와 허수부를 표시한다.

   - 왼쪽 반평면은 $\operatorname{Re}(\lambda)<0$, 오른쪽 반평면은 $\operatorname{Re}(\lambda)>0$이다.

2. **위상평면**

   - 상태벡터 $\mathbf{x}(t)$가 $x_1$-$x_2$ 평면에서 어떤 경로를 따라 움직이는지 보여 준다.

   - 실수 고유벡터가 존재하면 해당 방향도 점선으로 나타난다.

3. **시간응답**

   - 같은 궤적을 $x_1(t)$, $x_2(t)$라는 두 시간함수로 나누어 보여 준다.

{% include linear-system-explorer.html %}

처음에는 다음 세 가지 관계만 확실히 잡으면 된다.

$$
\boxed{
\operatorname{Re}(\lambda)<0
\quad\Longrightarrow\quad
\text{감쇠}
}
$$

$$
\boxed{
\operatorname{Re}(\lambda)>0
\quad\Longrightarrow\quad
\text{성장 또는 발산}
}
$$

$$
\boxed{
\operatorname{Im}(\lambda)\ne0
\quad\Longrightarrow\quad
\text{진동 또는 회전 성분}
}
$$

고유벡터는 시스템이 특별히 자연스럽게 움직이는 방향이고,

고유값은 그 방향의 상태가 시간에 따라 어떻게 증가·감쇠·진동하는지를 결정한다.

---

# 1. 동차선형계

## 1.1 기본 형태

가장 기본형은

$$
\boxed{
\mathbf{x}^{\prime} = A\mathbf{x}
}
$$

이다.

2변수라면

$$
\mathbf{x}=
\begin{bmatrix}
x_1\\
x_2
\end{bmatrix},
\qquad
A=
\begin{bmatrix}
a&b\\
c&d
\end{bmatrix}
$$

이므로

$$
\begin{cases}
x_1^{\prime}=ax_1+bx_2\\
x_2^{\prime}=cx_1+dx_2
\end{cases}
$$

가 된다.

이것을 **동차선형계(homogeneous linear system)**라고 한다.

왜 동차냐면 우변에 외부입력 항이 없기 때문이다.

즉 시스템은 자기 내부의 상태만으로 움직인다.

---

## 1.2 왜 행렬형이 좋은가?

식 두 개를 따로 보는 것보다

$$
\mathbf{x}^{\prime} = A\mathbf{x}
$$

처럼 한 줄로 보면 구조가 훨씬 잘 보인다.

예를 들어

$$
\begin{cases}
x_1^{\prime}=3x_1+4x_2\\
x_2^{\prime}=-x_1+x_2
\end{cases}
$$

는

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
3&4\\
-1&1
\end{bmatrix}
\mathbf{x}
$$

가 된다.

이 표현의 장점은 다음과 같다.

- 변수 수가 많아져도 표현이 깔끔함

- 고유값, 대각화, 지수함수를 바로 적용 가능

- 컴퓨터 계산과 바로 연결됨

- 상태공간 표현과 완전히 같은 꼴임

---

## 1.3 해의 모양을 추측해 보자

1계 선형방정식

$$
y^{\prime}=\lambda y
$$

의 해가

$$
y=Ce^{\lambda t}
$$

라는 건 이미 알고 있다.

그러면 벡터방정식에서도 비슷하게

$$
\mathbf{x}(t)=\mathbf{v} e^{\lambda t}
$$

같은 꼴을 넣어보고 싶어진다.

실제로 대입하면

$$
\mathbf{x}^{\prime}(t)=\lambda \mathbf{v} e^{\lambda t}
$$

이고,

우변은

$$
A\mathbf{x}(t)=A\mathbf{v} e^{\lambda t}
$$

이다.

따라서

$$
\lambda \mathbf{v} e^{\lambda t}=A\mathbf{v} e^{\lambda t}
$$

이고 $e^{\lambda t}\neq0$ 이므로

$$
\boxed{
A\mathbf{v}=\lambda\mathbf{v}
}
$$

를 얻는다.

즉 **해를 지수함수 꼴로 찾으려 하면 고유값 문제로 바뀐다.**

이게 이 단원의 핵심 출발점이다.

---

## 1.4 고유값이 왜 중요한가?

고유값 $\lambda$와 고유벡터 $\mathbf{v}$가 있으면

$$
\mathbf{x}(t)=\mathbf{v} e^{\lambda t}
$$

가 하나의 해가 된다.

만약 고유값이 여러 개 있고 그에 대응하는 고유벡터들이 독립이면, 이 해들을 선형결합해서 전체해를 만들 수 있다.

즉

$$
\boxed{
\mathbf{x}(t)=c_1\mathbf{v}_1 e^{\lambda_1 t}
+c_2\mathbf{v}_2 e^{\lambda_2 t}
+\cdots
}
$$

형태가 된다.

그러므로 결국 연립선형계의 동작은 거의 전부 **행렬 $A$의 고유값 구조**에 달려 있다.

---

## 1.5 예제 1: 가장 단순한 분리형 시스템

다음 계를 보자.

$$
\begin{cases}
x_1^{\prime}=2x_1\\
x_2^{\prime}=-x_2
\end{cases}
$$

행렬형으로는

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
2&0\\
0&-1
\end{bmatrix}
\mathbf{x}
$$

이다.

이건 이미 대각행렬이므로 두 식이 사실상 분리되어 있다.

첫 번째 식은

$$
x_1=C_1e^{2t}
$$

이고,

두 번째 식은

$$
x_2=C_2e^{-t}
$$

이다.

따라서 전체해는

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
C_1e^{2t}\\
C_2e^{-t}
\end{bmatrix}
}
$$

이다.

### 해석

- $x_1$은 $t$가 증가할수록 폭발적으로 증가

- $x_2$는 0으로 감쇠

- 한 축은 발산, 다른 축은 수렴

따라서 위상평면에서는 **안장점(saddle point)** 형태가 된다.

---

## 1.6 예제 2: 서로 결합된 계

다음 계를 보자.

$$
\begin{cases}
x_1^{\prime}=4x_1+x_2\\
x_2^{\prime}=2x_1+3x_2
\end{cases}
$$

행렬은

$$
A=
\begin{bmatrix}
4&1\\
2&3
\end{bmatrix}
$$

이다.

이제 고유값을 구한다.

특성방정식은

$$
\det(A-\lambda I)=0
$$

즉

$$
\begin{vmatrix}
4-\lambda&1\\
2&3-\lambda
\end{vmatrix}=0
$$

이다.

전개하면

$$
(4-\lambda)(3-\lambda)-2=0
$$

즉

$$
\lambda^2-7\lambda+10=0
$$

이므로

$$
\boxed{
\lambda_1=5,\qquad \lambda_2=2
}
$$

이다.

### $\lambda_1=5$ 일 때

$$
(A-5I)\mathbf{v}=0
$$

이므로

$$
\begin{bmatrix}
-1&1\\
2&-2
\end{bmatrix}
\mathbf{v}=0
$$

이다.

따라서 $v_2=v_1$ 이고, 고유벡터 하나는

$$
\mathbf{v}_1=
\begin{bmatrix}
1\\
1
\end{bmatrix}
$$

로 잡을 수 있다.

### $\lambda_2=2$ 일 때

$$
(A-2I)\mathbf{v}=0
$$

이면

$$
\begin{bmatrix}
2&1\\
2&1
\end{bmatrix}
\mathbf{v}=0
$$

이다.

따라서 $2v_1+v_2=0$, 즉 $v_2=-2v_1$ 이므로

$$
\mathbf{v}_2=
\begin{bmatrix}
1\\
-2
\end{bmatrix}
$$

로 잡을 수 있다.

### 전체해

따라서

$$
\boxed{
\mathbf{x}(t)=
c_1
\begin{bmatrix}
1\\
1
\end{bmatrix}
e^{5t}
+
c_2
\begin{bmatrix}
1\\
-2
\end{bmatrix}
e^{2t}
}
$$

이다.

### 해석

두 지수항 모두 실수부가 양수이므로 해는 대체로 발산한다.

특히 $e^{5t}$가 $e^{2t}$보다 훨씬 빨리 커지므로 긴 시간이 지나면 대부분의 해는

$$
\begin{bmatrix}
1\\
1
\end{bmatrix}
$$

방향에 가까워진다.

즉 **가장 큰 고유값에 대응하는 고유모드가 장기 거동을 지배한다.**

---

## 1.7 전자공학 예시: 2상태 회로 모델

연속시간 상태방정식이

$$
\mathbf{x}^{\prime}=A\mathbf{x}
$$

꼴이라고 하자.

여기서

$$
\mathbf{x}=
\begin{bmatrix}
v_C\\
i_L
\end{bmatrix}
$$

처럼 커패시터 전압과 인덕터 전류를 상태로 잡는 경우가 많다.

그러면 회로의 자연응답은 결국 행렬 $A$의 고유값으로 결정된다.

- 고유값이 둘 다 음수 → 감쇠하고 안정

- 하나라도 양수 → 불안정

- 켤레복소수 → 진동성 응답 포함

즉 회로의 **극점(pole)**을 보는 것과 거의 같은 이야기다.

---

# 2. 대각화에 의한 해

## 2.1 왜 대각화가 필요한가?

행렬이 이미 대각행렬이면

$$
\mathbf{x}^{\prime}=D\mathbf{x}
$$

는 성분별로 따로 풀리므로 너무 쉽다.

문제는 일반 행렬 $A$는 대각행렬이 아니라는 점이다.

그런데 만약 어떤 가역행렬 $P$가 있어서

$$
\boxed{
A=PDP^{-1}
}
$$

로 쓸 수 있다면, 즉 $A$가 대각화 가능하다면 문제를 쉬운 꼴로 바꿀 수 있다.

---

## 2.2 새 변수로 바꾸는 과정

새 변수

$$
\boxed{
\mathbf{x}=P\mathbf{y}
}
$$

를 도입하자.

미분하면

$$
\mathbf{x}^{\prime}=P\mathbf{y}^{\prime}
$$

이다. 원래 방정식

$$
\mathbf{x}^{\prime}=A\mathbf{x}
$$

에 대입하면

$$
P\mathbf{y}^{\prime}=A(P\mathbf{y})
$$

이고,

$$
P\mathbf{y}^{\prime}=PDP^{-1}P\mathbf{y}=PD\mathbf{y}
$$

이다.

양변에 $P^{-1}$를 곱하면

$$
\boxed{
\mathbf{y}^{\prime}=D\mathbf{y}
}
$$

를 얻는다.

즉 **복잡한 결합계가 독립적인 여러 1계 방정식으로 분해된다.**

---

## 2.3 예제 3: 대각화로 풀기

다음 계를 보자.

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
2&1\\
1&2
\end{bmatrix}\mathbf{x}
$$

앞에서 배운 것처럼 이 행렬의 고유값은

$$
\lambda_1=3,\qquad \lambda_2=1
$$

이고, 대응하는 고유벡터는

$$
\mathbf{v}_1=
\begin{bmatrix}
1\\
1
\end{bmatrix},
\qquad
\mathbf{v}_2=
\begin{bmatrix}
1\\
-1
\end{bmatrix}
$$

이다.

따라서

$$
P=
\begin{bmatrix}
1&1\\
1&-1
\end{bmatrix},
\qquad
D=
\begin{bmatrix}
3&0\\
0&1
\end{bmatrix}
$$

이다.

새 변수 $\mathbf{x}=P\mathbf{y}$ 를 놓으면

$$
\mathbf{y}^{\prime}=D\mathbf{y}
$$

즉

$$
\begin{cases}
y_1^{\prime}=3y_1\\
y_2^{\prime}=y_2
\end{cases}
$$

가 된다.

따라서

$$
y_1=C_1e^{3t},\qquad y_2=C_2e^t
$$

이고,

$$
\mathbf{y}=
\begin{bmatrix}
C_1e^{3t}\\
C_2e^t
\end{bmatrix}
$$

이다.

다시 $\mathbf{x}=P\mathbf{y}$ 로 돌아가면

$$
\mathbf{x}=
\begin{bmatrix}
1&1\\
1&-1
\end{bmatrix}
\begin{bmatrix}
C_1e^{3t}\\
C_2e^t
\end{bmatrix}
$$
즉

$$
\boxed{
\mathbf{x}(t)=
C_1
\begin{bmatrix}
1\\
1
\end{bmatrix}e^{3t}
+
C_2
\begin{bmatrix}
1\\
-1
\end{bmatrix}e^t
}
$$

이다.

이것은 앞에서 직접 고유값 방식으로 얻는 결과와 완전히 같다.

---

## 2.4 대각화의 의미를 직관적으로 이해하기

원래 좌표 $(x_1,x_2)$에서는 두 성분이 서로 얽혀 있다.

하지만 고유벡터를 축으로 사용하는 새 좌표 $(y_1,y_2)$에서는

- $y_1$ 방향은 $e^{\lambda_1 t}$ 로만 움직이고

- $y_2$ 방향은 $e^{\lambda_2 t}$ 로만 움직인다.

즉 대각화는 시스템을 **자연모드(natural mode)**로 분해하는 작업이다.

전자공학에서 이 말은 아주 중요하다.

회로나 진동계나 다중 상태 시스템을 보면 실제 응답은 여러 자연모드의 합으로 나타난다.

---

## 2.5 복소 고유값이 나오면?

예를 들어 고유값이

$$
\lambda=\alpha\pm j\beta
$$

처럼 나오면 해는

$$
e^{(\alpha+j\beta)t}
=
e^{\alpha t}(\cos\beta t+j\sin\beta t)
$$

와 연결된다.

따라서 실제해에서는

- $e^{\alpha t}$: 감쇠 또는 성장

- $\cos\beta t,\sin\beta t$: 진동

이 동시에 나타난다.

즉 복소 고유값은 **진동하는 연립계**를 의미한다.
---

## 2.6 예제 4: 복소 고유값이 있는 경우

다음 계를 보자.

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
0&-1\\
1&0
\end{bmatrix}\mathbf{x}
$$

즉

$$
\begin{cases}
x_1^{\prime}=-x_2\\
x_2^{\prime}=x_1
\end{cases}
$$

이다.

특성방정식은

$$
\lambda^2+1=0
$$

이므로

$$
\lambda=\pm j
$$

이다.

이 계는 원점 주위를 도는 순수 회전계다.

실제로 두 번 미분하면

$$
x_1^{\prime\prime}=-x_1
$$

이므로

$$
x_1=C_1\cos t+C_2\sin t
$$

형태가 나오고, $x_2$도 비슷하게 나온다.

결국 해는

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
C_1\cos t-C_2\sin t\\
C_1\sin t+C_2\cos t
\end{bmatrix}
}
$$

꼴이다.

### 해석

- 크기는 유지

- 방향만 계속 회전

- 위상평면에서는 원 또는 타원형 궤적

즉 이것이 **중심(center)** 형태이다.

---

# 3. 비동차 선형계

## 3.1 기본 형태

외부입력이 있으면

$$
\boxed{
\mathbf{x}^{\prime}=A\mathbf{x}+\mathbf{f}(t)
}
$$

형태가 된다.

이것을 **비동차 선형계(nonhomogeneous linear system)**라고 한다.

여기서 $\mathbf{f}(t)$는 외부에서 시스템을 밀어주는 입력이다.

전자공학에서는

- 전압원

- 전류원

- 강제 입력

- 제어 입력

- 외란(disturbance)

등으로 해석할 수 있다.

---

## 3.2 전체해의 구조

비동차 선형계의 해는 보통

$$
\boxed{
\mathbf{x}(t)=\mathbf{x}_h(t)+\mathbf{x}_p(t)
}
$$

로 쓴다.

- $\mathbf{x}_h(t)$: 동차방정식 $\mathbf{x}^{\prime}=A\mathbf{x}$ 의 해

- $\mathbf{x}_p(t)$: 비동차 방정식의 특수해

이 구조는 스칼라 1계, 2계 선형방정식에서 하던 것과 똑같다.

---

## 3.3 왜 이런 분해가 가능한가?

선형성이 있기 때문이다.

만약

$$
\mathbf{x}_h^{\prime}=A\mathbf{x}_h
$$

이고,

$$
\mathbf{x}_p^{\prime}=A\mathbf{x}_p+\mathbf{f}(t)
$$

이면 둘을 더한 $\mathbf{x}=\mathbf{x}_h+\mathbf{x}_p$ 에 대해

$$
\mathbf{x}^{\prime}
=
\mathbf{x}_h^{\prime}+\mathbf{x}_p^{\prime}
=
A\mathbf{x}_h+(A\mathbf{x}_p+\mathbf{f})
=
A(\mathbf{x}_h+\mathbf{x}_p)+\mathbf{f}
$$
즉

$$
\mathbf{x}^{\prime}=A\mathbf{x}+\mathbf{f}(t)
$$

가 성립한다.

---

## 3.4 예제 5: 상수 입력이 있는 경우

다음 계를 보자.

$$
\begin{cases}
x_1^{\prime}=x_1+x_2+1\\
x_2^{\prime}=x_1+x_2+2
\end{cases}
$$

행렬형으로는

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
1&1\\
1&1
\end{bmatrix}\mathbf{x}
+
\begin{bmatrix}
1\\
2
\end{bmatrix}
$$

이다.

### 1단계: 동차해

먼저 동차계

$$
\mathbf{x}_h^{\prime}=
\begin{bmatrix}
1&1\\
1&1
\end{bmatrix}\mathbf{x}_h
$$

를 푼다.

행렬의 고유값은

$$
\lambda_1=2,\qquad \lambda_2=0
$$

이고, 대응하는 고유벡터는 예를 들어

$$
\mathbf{v}_1=
\begin{bmatrix}
1\\
1
\end{bmatrix},
\qquad
\mathbf{v}_2=
\begin{bmatrix}
1\\
-1
\end{bmatrix}
$$

이다.

따라서

$$
\mathbf{x}_h
=
c_1
\begin{bmatrix}
1\\
1
\end{bmatrix}e^{2t}
+
c_2
\begin{bmatrix}
1\\
-1
\end{bmatrix}
$$

이다.

### 2단계: 특수해 찾기

우변이 상수벡터이므로 상수벡터 특수해

$$
\mathbf{x}_p=
\begin{bmatrix}
a\\
b
\end{bmatrix}
$$

를 가정해 보자.

그러면 $\mathbf{x}_p^{\prime}=0$ 이므로

$$
0=
\begin{bmatrix}
1&1\\
1&1
\end{bmatrix}
\begin{bmatrix}
a\\
b
\end{bmatrix}
+
\begin{bmatrix}
1\\
2
\end{bmatrix}
$$

즉

$$
\begin{cases}
a+b=-1\\
a+b=-2
\end{cases}
$$

가 되어 모순이다.

즉 상수형 특수해는 존재하지 않는다.

이럴 때는 조금 더 넓게

$$
\mathbf{x}_p=
\mathbf{u} t+\mathbf{v}
$$

같은 꼴을 시도하거나, 뒤에서 배울 **매개변수 변화법/행렬 지수함수 공식**을 쓰는 것이 자연스럽다.

이 예제는 오히려 “비동차계는 동차계보다 조금 더 세심하게 접근해야 한다”는 점을 보여준다.

---

## 3.5 예제 6: 상수 특수해가 존재하는 경우

다음 계를 보자.

$$
\begin{cases}
x_1^{\prime}=-x_1+x_2+1\\
x_2^{\prime}=-2x_2+3
\end{cases}
$$

행렬형은

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
-1&1\\
0&-2
\end{bmatrix}\mathbf{x}
+
\begin{bmatrix}
1\\
3
\end{bmatrix}
$$

이다.

상수 특수해

$$
\mathbf{x}_p=
\begin{bmatrix}
a\\
b
\end{bmatrix}
$$

를 가정하면

$$
0=
\begin{bmatrix}
-1&1\\
0&-2
\end{bmatrix}
\begin{bmatrix}
a\\
b
\end{bmatrix}
+
\begin{bmatrix}
1\\
3
\end{bmatrix}
$$

이므로

$$
\begin{cases}
-a+b+1=0\\
-2b+3=0
\end{cases}
$$

이다.

둘째 식에서

$$
b=\frac32
$$

이고,

첫째 식에서

$$
-a+\frac32+1=0
\quad\Rightarrow\quad
a=\frac52
$$

이다.

따라서

$$
\mathbf{x}_p=
\begin{bmatrix}
5/2\\
3/2
\end{bmatrix}
$$

이다.

이제 동차해만 더하면 전체해를 얻는다.

---

## 3.6 입력이 있다는 것은 무슨 뜻인가?

동차계는 “입력이 꺼진 시스템이 자기 내부 특성만으로 어떻게 움직이는가”를 보여준다.

비동차계는 여기에 외부에서 계속 힘을 주는 상황이다.

전자공학으로 해석하면

- RC/RLC 회로에 전압원을 인가

- 제어 시스템에 입력 $u(t)$ 를 넣음

- 어떤 센서 시스템에 외란이 들어옴

같은 경우다.

따라서 응답은 보통

$$
\boxed{
\text{자연응답}+\text{강제응답}
}
$$

으로 나뉜다.

---

# 4. 행렬 지수함수

## 4.1 왜 $e^{At}$ 가 나오나?

스칼라 방정식

$$
y^{\prime}=ay
$$

의 해는

$$
y=Ce^{at}
$$

였다.

그렇다면 행렬 방정식

$$
\mathbf{x}^{\prime}=A\mathbf{x}
$$

에서는 자연스럽게

$$
e^{At}
$$

가 등장해야 할 것 같다.

실제로 해는

$$
\boxed{
\mathbf{x}(t)=e^{At}\mathbf{x}(0)
}
$$

형태로 쓸 수 있다.

여기서 $e^{At}$ 를 **행렬 지수함수(matrix exponential)**라고 한다.

---

## 4.2 정의

스칼라 지수함수의 멱급수 정의를 그대로 따라

$$
e^z
=
1+z+\frac{z^2}{2!}+\frac{z^3}{3!}+\cdots
$$

에서 $z$ 대신 $At$ 를 넣으면

$$
\boxed{
e^{At}
=
I+At+\frac{(At)^2}{2!}+\frac{(At)^3}{3!}+\cdots
}
$$

이다.

즉

$$
e^{At}
=
I+At+\frac{A^2t^2}{2!}+\frac{A^3t^3}{3!}+\cdots
$$

이다.

이 정의가 갑자기 이상하게 느껴질 수 있지만, 스칼라 경우를 그대로 행렬로 확장한 것이다.

---

## 4.3 정말 해가 되는지 확인

$$
\mathbf{x}(t)=e^{At}\mathbf{c}
$$

라고 놓자.

미분하면

$$
\mathbf{x}^{\prime}(t)=\frac{d}{dt}(e^{At})\mathbf{c}
$$

이다.

행렬 지수함수는

$$
\frac{d}{dt}e^{At}=Ae^{At}
$$

를 만족하므로

$$
\mathbf{x}^{\prime}(t)=Ae^{At}\mathbf{c}
=A\mathbf{x}(t)
$$

이다.

즉 실제로 해가 된다.

또 $t=0$ 에서

$$
e^{A\cdot0}=I
$$

이므로

$$
\mathbf{x}(0)=I\mathbf{c}=\mathbf{c}
$$

이다.

따라서 초기조건도 자연스럽게 반영된다.

---

## 4.4 대각화 가능할 때 $e^{At}$ 계산

만약

$$
A=PDP^{-1}
$$

이면

$$
\boxed{
e^{At}=Pe^{Dt}P^{-1}
}
$$

가 된다.

그리고 $D$ 가 대각행렬이면

$$
D=
\begin{bmatrix}
\lambda_1&0&\cdots\\
0&\lambda_2&\cdots\\
\vdots&\vdots&\ddots
\end{bmatrix}
$$

에 대해

$$
\boxed{
e^{Dt}
=
\begin{bmatrix}
e^{\lambda_1 t}&0&\cdots\\
0&e^{\lambda_2 t}&\cdots\\
\vdots&\vdots&\ddots
\end{bmatrix}
}
$$

이다.

즉 행렬 지수함수 계산은 결국 고유값 계산과 연결된다.

---

## 4.5 예제 7: 행렬 지수함수 직접 계산

다음 행렬을 보자.

$$
A=
\begin{bmatrix}
2&0\\
0&-1
\end{bmatrix}
$$

그러면

$$
A^2=
\begin{bmatrix}
4&0\\
0&1
\end{bmatrix},
\qquad
A^3=
\begin{bmatrix}
8&0\\
0&-1
\end{bmatrix}
$$

처럼 각 대각성분이 따로 거듭제곱된다.

따라서

$$
e^{At}
=
\begin{bmatrix}
e^{2t}&0\\
0&e^{-t}
\end{bmatrix}
$$

임을 쉽게 알 수 있다.

즉

$$
\mathbf{x}(t)=e^{At}\mathbf{x}(0)
$$

는

$$
\mathbf{x}(0)=
\begin{bmatrix}
x_{10}\\
x_{20}
\end{bmatrix}
$$

일 때

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
e^{2t}x_{10}\\
e^{-t}x_{20}
\end{bmatrix}
}
$$

가 된다.

이건 앞에서 직접 푼 결과와 같다.

---

## 4.6 비동차계와 행렬 지수함수

비동차계

$$
\mathbf{x}^{\prime}=A\mathbf{x}+\mathbf{f}(t)
$$

의 해는 행렬 지수함수를 이용하면

$$
\boxed{
\mathbf{x}(t)
=
e^{At}\mathbf{x}(0)
+
\int_0^t e^{A(t-\tau)}\mathbf{f}(\tau)\\,d\tau
}
$$

로 쓸 수 있다.

이 식은 아주 중요하다.

첫 항은 자연응답이고,

$$
e^{At}\mathbf{x}(0)
$$

둘째 항은 입력에 의한 강제응답이다.

$$
\int_0^t e^{A(t-\tau)}\mathbf{f}(\tau)\\,d\tau
$$

이 항은 연속시간 선형시스템의 **컨볼루션 구조**와도 연결된다.

---

## 문제 1

다음 동차선형계를 풀어라.

$$
\begin{cases}
x_1^{\prime}=3x_1\\
x_2^{\prime}=-2x_2
\end{cases}
$$

### 풀이

두 식이 서로 완전히 분리되어 있으므로 각각 따로 풀면 된다.

첫째 식

$$
x_1^{\prime}=3x_1
$$

의 해는

$$
x_1=C_1e^{3t}
$$

이다.

둘째 식

$$
x_2^{\prime}=-2x_2
$$

의 해는

$$
x_2=C_2e^{-2t}
$$

이다.

따라서

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
C_1e^{3t}\\
C_2e^{-2t}
\end{bmatrix}
}
$$

이다.

### 해석

한 성분은 커지고 다른 성분은 줄어든다. 따라서 원점은 안장점 성질을 가진다.

---

## 문제 2

다음 계를 고유값을 이용해 풀어라.

$$
\mathbf{x}^{\prime}=
\begin{bmatrix}
1&2\\
2&1
\end{bmatrix}\mathbf{x}
$$

### 풀이 1단계: 고유값

특성방정식은

$$
\det(A-\lambda I)=
\begin{vmatrix}
1-\lambda&2\\
2&1-\lambda
\end{vmatrix}
=0
$$

이다.

전개하면

$$
(1-\lambda)^2-4=0
$$

즉

$$
\lambda^2-2\lambda-3=0
$$

이므로

$$
\boxed{
\lambda_1=3,\qquad \lambda_2=-1
}
$$

이다.

### 풀이 2단계: 고유벡터

$\lambda_1=3$ 에 대해

$$
(A-3I)\mathbf{v}=0
$$

즉

$$
\begin{bmatrix}
-2&2\\
2&-2
\end{bmatrix}\mathbf{v}=0
$$

이므로 $v_2=v_1$ 이다.

따라서

$$
\mathbf{v}_1=
\begin{bmatrix}
1\\
1
\end{bmatrix}
$$

로 잡을 수 있다.

$\lambda_2=-1$ 에 대해

$$
(A+I)\mathbf{v}=0
$$

즉

$$
\begin{bmatrix}
2&2\\
2&2
\end{bmatrix}\mathbf{v}=0
$$

이므로 $v_2=-v_1$ 이다.

따라서

$$
\mathbf{v}_2=
\begin{bmatrix}
1\\
-1
\end{bmatrix}
$$

이다.

### 풀이 3단계: 전체해

따라서

$$
\boxed{
\mathbf{x}(t)=
c_1
\begin{bmatrix}
1\\
1
\end{bmatrix}e^{3t}
+
c_2
\begin{bmatrix}
1\\
-1
\end{bmatrix}e^{-t}
}
$$

이다.

### 해석

- $e^{3t}$ 모드는 성장

- $e^{-t}$ 모드는 감쇠

따라서 대부분의 초기조건에서 긴 시간이 지나면 성장 모드가 우세해진다.

---

## 문제 3

초기조건

$$
\mathbf{x}(0)=
\begin{bmatrix}
2\\
0
\end{bmatrix}
$$

를 만족하도록 문제 2의 해를 구하라.

### 풀이

문제 2의 일반해는

$$
\mathbf{x}(t)=
c_1
\begin{bmatrix}
1\\
1
\end{bmatrix}e^{3t}
+
c_2
\begin{bmatrix}
1\\
-1
\end{bmatrix}e^{-t}
$$

이다.

$t=0$ 을 대입하면

$$
\begin{bmatrix}
2\\
0
\end{bmatrix}
=
c_1
\begin{bmatrix}
1\\
1
\end{bmatrix}
+
c_2
\begin{bmatrix}
1\\
-1
\end{bmatrix}
=
\begin{bmatrix}
c_1+c_2\\
c_1-c_2
\end{bmatrix}
$$

이다.

따라서

$$
\begin{cases}
c_1+c_2=2\\
c_1-c_2=0
\end{cases}
$$

이므로

$$
c_1=1,\qquad c_2=1
$$

이다.

따라서

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
e^{3t}+e^{-t}\\
e^{3t}-e^{-t}
\end{bmatrix}
}
$$

이다.

---

## 문제 4

다음 비동차계를 풀어라.

$$
\begin{cases}
x_1^{\prime}=-x_1+1\\
x_2^{\prime}=-2x_2+4
\end{cases}
$$

### 풀이

사실상 분리된 계이다.

첫째 식:

$$
x_1^{\prime}+x_1=1
$$

상수 특수해 $x_{1p}=A$ 를 가정하면

$$
A=1
$$

이므로

$$
x_1=C_1e^{-t}+1
$$

이다.

둘째 식:

$$
x_2^{\prime}+2x_2=4
$$

상수 특수해 $x_{2p}=B$ 를 가정하면

$$
2B=4
\quad\Rightarrow\quad
B=2
$$

이므로

$$
x_2=C_2e^{-2t}+2
$$

이다.

따라서

$$
\boxed{
\mathbf{x}(t)=
\begin{bmatrix}
C_1e^{-t}+1\\
C_2e^{-2t}+2
\end{bmatrix}
}
$$

이다.

### 해석

입력이 없었으면 0으로 감쇠했겠지만, 상수 입력 때문에 결국

$$
\begin{bmatrix}
1\\
2
\end{bmatrix}
$$

쪽으로 수렴한다.

즉 입력이 새로운 평형점을 만든다.

---

## 문제 5

다음 행렬의 지수함수를 구하여라.

$$
A=
\begin{bmatrix}
0&0\\
0&-3
\end{bmatrix}
$$

### 풀이

대각행렬이므로 각 성분에 대해 바로 지수함수를 취하면 된다.

$$
\boxed{
e^{At}
=
\begin{bmatrix}
1&0\\
0&e^{-3t}
\end{bmatrix}
}
$$

이다.

왜 첫 번째 성분이 1이냐면 대각원소가 0이기 때문이다.

즉 $e^{0\cdot t}=1$ 이다.

---

# 자주 헷갈리는 포인트 정리

## 1. 동차계와 비동차계의 차이

동차계는

$$
\mathbf{x}^{\prime}=A\mathbf{x}
$$

꼴이고, 외부입력이 없다.

비동차계는

$$
\mathbf{x}^{\prime}=A\mathbf{x}+\mathbf{f}(t)
$$

꼴이고, 외부입력이 있다.

즉 동차계는 자연응답만 보고, 비동차계는 자연응답과 강제응답을 함께 본다.

---

## 2. 고유값이 왜 해를 결정하나?

해를

$$
\mathbf{x}=\mathbf{v} e^{\lambda t}
$$

꼴로 가정하면

$$
A\mathbf{v}=\lambda\mathbf{v}
$$

가 나와서 고유값 문제가 되기 때문이다.

즉 고유값은 시스템이 자기 스스로 가장 자연스럽게 움직이는 지수모드의 지수율이다.

---

## 3. 대각화와 행렬 지수함수는 무슨 관계인가?

$A$ 가 대각화 가능하면

$$
A=PDP^{-1}
$$

이므로

$$
e^{At}=Pe^{Dt}P^{-1}
$$

이다.

즉 대각화는 행렬 지수함수 계산을 쉽게 만드는 도구다.

---

## 4. 복소 고유값이 나오면 실제해는 복소수인가?

계수가 실수행렬이라면 최종적으로는 실수해로 정리할 수 있다.

복소 고유값은 보통 켤레쌍으로 나오고, 이를 합치면 $\cos$, $\sin$ 이 들어간 실수형 해가 된다.

즉 복소수는 계산을 편하게 해 주는 중간 도구라고 보면 된다.

---

## 5. 초기조건은 어디에 들어가나?

일반해를 구한 뒤 $t=0$ 을 대입해서 상수 $c_1,c_2,\dots$ 를 정한다.

또는 행렬 지수함수 형식

$$
\mathbf{x}(t)=e^{At}\mathbf{x}(0)
$$

에서는 초기조건이 자연스럽게 $\mathbf{x}(0)$ 로 들어간다.

---

# 전자공학 관점 요약

전자공학 관점에서 이 내용을 정말 짧게 요약하면 다음과 같다.

$$
\boxed{
\text{연립선형미분방정식은 상태공간 모델의 핵심이다.}
}
$$

그리고 시스템의 시간응답은

$$
\boxed{
\text{행렬 }A\text{의 고유값과 }e^{At}\text{에 의해 결정된다.}
}
$$

좀 더 구체적으로는

- 고유값 → 안정성, 감쇠, 진동 여부

- 고유벡터 → 자연모드 방향

- 대각화 → 결합된 계를 독립모드로 분해

- 행렬 지수함수 → 시간응답 전체를 한 번에 표현

- 비동차항 → 입력에 의한 강제응답

을 의미한다.

즉 이 단원은 나중에 배우는

- 제어공학의 상태방정식

- 신호 및 시스템

- RLC 회로의 과도응답

- 연속시간 필터

- 전자기학의 모드 해석

- 수치해석과 시뮬레이션

의 수학적 기반이 된다.

---

# 마지막 핵심만 다시 정리

## 핵심 1

동차계

$$
\mathbf{x}^{\prime}=A\mathbf{x}
$$

의 해를 찾으려 하면

$$
\mathbf{x}=\mathbf{v} e^{\lambda t}
$$

를 가정하게 되고, 결국

$$
A\mathbf{v}=\lambda\mathbf{v}
$$

라는 고유값 문제로 간다.

---

## 핵심 2

$A$ 가 대각화 가능하면

$$
A=PDP^{-1}
$$

로 써서 문제를 훨씬 쉽게 푼다.

---

## 핵심 3

비동차계

$$
\mathbf{x}^{\prime}=A\mathbf{x}+\mathbf{f}(t)
$$

는

$$
\text{동차해}+\text{특수해}
$$

로 푼다.

---

## 핵심 4

행렬 지수함수

$$
e^{At}
$$

는 연립선형미분방정식의 자연스러운 해 표현이며,

$$
\mathbf{x}(t)=e^{At}\mathbf{x}(0)
$$

또는

$$
\mathbf{x}(t)
=
e^{At}\mathbf{x}(0)
+
\int_0^t e^{A(t-\tau)}\mathbf{f}(\tau)\\,d\tau
$$

와 같이 사용된다.