---
layout: single
title: Operating sysetem - Address space
categories: Operating_system
tags: OS
toc: true
author_profile: false
---

가상 메모리를 이해하기 위해서는 사용자 프로그램이 생성하는 모든 주소는 가상주소라는 것부터 시작해야한다. 프로세스가 자신만의 커다란 전용 메모리를 가진다는 환상을 제공하는 것이다. 운영체제는 각 프로세스에게 코드와 데이터를 저장할 수 있는 대용량의 연속된 **주소 공간(address space)**를 가지고 있다는 시각을 제공한다. 또 가상화를 통해 **고립(isolation)**과 **보호(protection)**을 할 수 있게 된다. 

# Adrress space


## 초기 시스템

<center><img src="/images/OS/add_past_mem.png" width = "500"></center><br>
이것은 초기의 메모리였다. 운영체제는 물리주고 0부터 상주하는 루틴의 집합이었고 나머지 메모리에 현재 프로그램들이 들어갔다.

- - -
## 멀티프로그래밍과 시분할

시간이 흐르고 **멀티프로그래밍(multi-programming)**의 시대가 왔다. 여러 프로세스가 실행 준비 상태에 있고 운영체제는 그들을 전환하면서 실행했다. 이런 전환은 CPU의 이용률이 증가하면서 효율성 개선을 위해 많은 노력을 하였다. 그러다가 사람들이 컴퓨터를 더 많이 사용하기 원하면서 **시분할(time-sharing)**의 개념이 나오게 되었다. 일괄처리방식으로 프로그램-디버그를 계속 하는 컴퓨팅 방법보다 현재 실행 중인 작업으로부터 즉시 응답을 하는 **대화식 이용(interactivity)**의 개념이 중요해지게 되었다.<br>
- - -
### 기초 시분할 구현
하나의 프로세스를 짧은 시간동안 실행을 시키고 이 기간 동안 프로세스에게 모든 메모리 접근 권환을 준다. 그런 다음 이 프로세스를 중단하고 중단 시점의 모든 상태를 디스크(저장 장치)에 저장하고 다른 프로세스의 상태를 탑재하여 또 짧은 시간 동안 실행시키는 엉성한 시분할을 구현하였다.<br>
이 방법엔 큰 문제가 있었다. 너무 느리게 동작하고 메모리가 커질수록 더 느리게 된다는 것이었다. 레지스터 상태를 저장하고 복원하는 것은 빨랐지만 메모리의 내용 전체를 디스크에 저장하는 것은 시간이 엄청 오래 걸리게 된다. 그래서 우리가 하려는 일은 프로세스 전환 시 프로세스를 메모리에 그대로 유지하면서 운영체제가 시분할 시스템을 효율적으로 구현할 수 있게 하는 것이다.<br>
<center><img src="/images/OS/add_mem1.png" width = "500"></center><br>
그림을 보면 세 개의 프로세스(A, B, C)는 512KB 물리 메모리에서 각기 작은 부분을 할당받았다. 하나의 CPU가 있을 때 운영체제는 실행할 한개의 프로세스(A)를 선택하고 다른 프로세스(B, C)는 준비 큐에서 대기하게 된다. 이렇게 시분할 시스템이 대중화되면서 운영체제는 여러 프로그램이 메모리에 동시에 존재하기 위해 **보호(protection)**이 중요하게 됐다. 우리는 한 프로세스가 다른 프로세스의 메모리를 읽거나 쓰는 상황을 원치 않는다는 것이다.<br>

# 주소 공간

운영체제는 **사용하기 쉬운(easy to use)** 메모리 개념을 만들어야한다. 이 개념이 바로 **주소 공간(address space)**이다. 운영 체제의 메모리 개념을 이해하는 것은 메모리를 어떻게 가상화 할지 이해하는게 중요하다.<br>
주소 공간에는 해당 프로세스의 코드가 포함되어야 한다. 그리고 전역 변수를 저장하는 공간(DATA), 지역 변수를 저장하는 공간(stack), 동적 할당받은 데이터를(Heap)을 저장하는 공간이 있다.<br>
<center><img src="/images/OS/add_mem_structure.png" width = "500"></center><br>
<center><img src="/images/OS/add_mem_space.png" width = "500"></center><br>
Text와 Data는 크기가 변하지 않는다. 이것은 아래의 그림에서 프로그램 코드와 같다. 그래서 주소 0부터 시작하여 들어가게 되고 정적이고 추가 메모리를 필요로 하지 않는다. 그런데 Stack과 Heap은 크기가 변할 수 있다. 그래서 주소 공간의 양 끝단에 배치하여 두 영역 모두 확장하는 것이 가능하도록 한다(나중에 쓰레드 개념이 나오면 또 이렇게 생기진 않았다.). 이 주소 공간은 운영체제가 실행 중인 프로그램에게 제공하는 **개념(abstraction)**이다. 즉, 실제 물리 주소에 존재하는 것은 아니다.<br>
<center><img src="/images/OS/warz.gif" width = "500"><<img src="/images/OS/heap_ex.gif" width = "250"></center><br>
왼쪽은 stack 오른쪽은 heap이다. 그런데 단순히 올라가고 내려온다로 생각하면 안되고 주소를 봐야한다. 주소가 작은곳에서 큰곳으로 가면 stack이고 그 반대면 heap이라고 하는게 정확하다.



# ◼︎ 목표

메모리를 가상화하기 위한 몇가지 목표에 대해 다뤄보자.
1. **투명성(transparency)**
운영체제는 실행 중인 프로그램이 가상 메모리(VM)의 존재를 인지하지 못하도록 구현해야한다. 프로그램은 자신이 전용 물리 메모리를 소유한 것처럼 행동해야한다. 
2. **효율성(efficiency)**
운영체제의 가상화는 시간과 공간측면에서 효율적이어야 한다. 너무 느려도 안되고 너무 많은 메모리를 써서도 안된다.
3. **보호(protection)**
프로세스를 다른 프로세스로부터 보호해야하고 운영체제 자신도 프로세스로부토 보호해야한다. 즉, 자신의 주소 공간 밖의 어느 것도 접근할 수 있어서는 안된다는 것이다.

- - -
# ◼︎ Memory API

UNIX에서 제공되는 간단하고 짧고 핵심적인 인터페이스만 살펴볼 것이다.


## 메모리 공간의 종류

C 프로그램이 실행됐다고 하면 두 가지 유형의 메모리 공간이 할당된다. 첫 번째는 스택(stack)메모리 할당과 반환이 컴파일러에서 암묵적으로 일어나기 때문에 **자동(automatic)** 매모리라고 불린다. <br>
```c
void func(){
    int x;
    ...
}
```
우리가 C에서 x라 불리는 정수를 위한 공간이 필요하면 이렇게 코드를 짜게 된다. 이렇게 하면 컴파일러가 알아서 ```func()```이 호출될 때 스택에 공간을 확보하고 리턴하면 컴파일러가 메모리를 반환한다. 그래서 함수 리턴을 하고도 계속 유지돼야하는 데이터는 스택에 저장하지 않는 것이 좋다.<br>
<br>
그래서 오랫동안 값이 유지되어야하는 변수를 위해 힙(heap)메모리라는 두 번째 유형의 메모리가 필요하다. 이것은 모든 할당과 반환이 프로그래머에 의해 명시적으로 처리된다. <br>

```c
void func() {
    int *x = (int *) malloc(sizeof(int));
    ...
}
```
이 코드는 정수에 대한 포인터를 힙에 할당하는 예이다. 주의 사항이 몇개 있는데 첫째는 한 행에 스택과 힙 할당이 모두 발생한다는 것이다. 우선 컴파일러가 포인터 변수 선언 ```int *x```를 만나면 정수 포인터를 위한 공간을 할당해야한다는 것을 안다. 프로그램이 ```malloc()```을 호출하여 정수를 위한 공간을 힙으로 부터 요구한다. ``malloc()```은 정수의 주소를 반환(실패시 NULL)하는데 이 주소는 스택에 저장되어 프로그램에 사용된다.<br>

## malloc() 함수

```malloc()```의 호출은 매우 간단한데 힙에 요청할 공간의 크기를 입력해주면 성공했으면 새로 할당된 공간에 대한 포인터를 사용자에게 반환하고 실패하면 NULL을 반환한다. 

```c
# include <stlib.h>
...
void *malloc(size_t size);
```
사실 헤더를 부를필요 없이 ```malloc()```이미 라이브러리에 있지만 헤터 파일을 이렇게 추가해두면 ```malloc()```을 올바르게 호출했는지 컴파일러가 검사할 수 있다. 전달된 인자의 개수와 올바른 데이터 타입의 인자를 전달했는지 검사를 한다.
```c
# include <stlib.h>
...
double *d = (double *) malloc(sizeof(double));
```
위의 코드는 ```double precision```의 부동 소수점 값을 위한 공간을 확보하기 위한 코드이다. ```malloc()```에서는 정확한 크기의 공간을 요청하기위해 ```sizeof()``` 연산자(함수가 아니다)를 사용한다.
```c
int *x = malloc(10 * sizeof(int));
printf("%d\n", sizeof(x));
```
위의 코드는 ```sizeof()```를 사용했을 때 발생할 수 있는 문제의 예시이다. 이렇게 되면 32비트 컴퓨터면 4 64비트면 8을 출력한다. 즉, x의 자료형에 대한 크기를 출력하게 되는 것이다.
```c
int x[10];
printf("%d\n", sizeof(x));
```
이렇게 하면 해결할 수 있지만 문제는 문자열을 ```malloc()```안에 넣었을 때 생길 수 있다. 문자열의 마지막은 항상 NULL값을 가지기 때문이다.<br>

## free() 함수

이 함수는 할당된 메모리를 해제한다.
```c
int *x = malloc(10 * sizeof(int));
free(x);
```
이렇게 써주면 해제가 된다.<br>

# ◼︎ 흔한 오류
