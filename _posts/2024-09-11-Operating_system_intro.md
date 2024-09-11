---
layout: single
title: "Operating sysetem - Introduction"
categories: Operating_system
tags: OS
toc: true
author_profile: false
---

# 들어가기 전에
운영체제에 대해 공부할 때 크게 3가지의 중요한 내용을 나눠서 공부하게 된다. 그 3개는 다음과 같다.

* 가상화(Virtualization)
* 병행성(Concurrency)
* 영속성(Persistence)

## 운영체제 (Operating system)
프로그램을 실행시킨다는 것은 여러개의 명령어를 실행(excuting instruction)한다는 것이다. 그래서 프로세서는 초당 매우 많은 횟수의 반입(fetch), 해석(decode), 실행(execute)하게 된다. 이렇게 명령어 작업이 완료된 후 다음 명령어를 실행하고 프로그램이 끝날 대 까지 실행을 계속 반복하는 것이다. 이것은 Von Neumann 컴퓨팅의 기본 모델을 나타낸 것이다.

이렇게 프로그램을 실행하고 메모리를 공유하고 장치와 상호작용 시키는 등의 일을 할 수 있게 하는 소프트웨어를 운영체제라고 한다.<br>
운영체제는 이런 여러가지의 일을 하기 위해서 가상화(virtualization)을 하게 된다. 프로세서, 메모리, 디스크 등의 물리적(physical)인 자원을 이용하여 가상(virtual) 형태의 자원을 생성하게 된다. 그래서 하나의 머신(single machine)이 OS를 이용하여 가상 머신(virtual machine)을 생성하여 여러가지의 일을 동시에 할 수 있게 된다.

### System call
사용자가 가상머신과 관련된 기능들을 운영체제에서 요청할 수 있도록 운영체제는 사용자에게 API(Application Programming Interface)를 제공한다. 즉, 사용자와 OS가 서로 상호작용(interact)할 수 있도록 하는 것을 의미하고 이 상호작용을 system call이라고 한다. API는 그래서 호환성을 위한 원칙이라고 생각하면 되고 이 system call들을 실제로 담고 있는 결과물을 standard library라고 한다.

### 자원 관리자(Resource manager)
가상화는 많은 프로그램이 하나의 CPU를 통해 동시에 실행될 수 있게하고 memory나 디스크와 같은 장치들을 공유할 수 있게 한다. 그래서 운영체제는 CPU, memory, 디스크와 같은 시스템의 자원을 효율적이고 공정하게 관리하는 역할을 하기 때문에 자원 관리자라고도 불린다.

# CPU 가상화 (CPU virtualization)
우선 코드를 통해 CPU가 어떻게 실행 되고 있는지 알아보려고 한다.

```c
1 #include <stdio.h>
2 #include <stdlib.h>
3 #include <sys/time.h>
4 #include <assert.h>
5 #include "common.h"

int
main(int argc, char *argv[])
{
    if (argc != 2) {
        fprintf(stderr, "usage: cpu <string>\n");
        exit(1);
    }
    char *str = argv[1];
    while (1) {
        Spin(1); // Repeatedly checks the time and returns once it has run for a second
        printf("%s\n", str);
    }
    return 0;
}
```

Spin()함수: 1초 동안 실행 된 후 리턴을 하는 함수<br>
int argc: 메인 함수에 전달되는 정보의 갯수<br>
char *agrv[]: 메인 함수에 실제로 전달 되는 정보(문자열 형태), 첫 번째 문자열은 항상 프로그램의 실행 경로로 항상 고정<br>
이 코드는 주어진 문자열을 1초마다 계속 출력하는 코드라고 생각하면 된다.<br>

이 코드를 다음과 같이 실행 하면 결과가 이렇게 된다
```
prompt> gcc -o cpu cpu.c -wall
prompt> ./cpu A
A
A
A
A
^C
prompt>
```
gcc -o 실행파일 파일명: 실행 파일을 생성하는 것 (여기서 파일 이름은 cpu.c가 되는 것이다.)<br>
./파일 정보: 파일을 실행하는것<br>
^C: 이렇게 계속 실행되는 프로그램을 Control-c를 눌러 프로그램을 종료시킬 수 있다.<br>
이 실행결과에서 볼 수 있듯 CPU하나가 계속 1초마다 문자열을 출력하는 프로그램을 실행하고 있다는 것을 알 수 있다.<br>
하지만 만약 여러가지 작업에 대한 여러 인스턴스를 동시에 실행하면 어떻게 될까?<br>
```
prompt> ./cpu A & ; ./cpu B & ; ./cpu C & ; ./cpu D &
[1] 7353
[2] 7354
[3] 7355
[4] 7356
A
B
D
C
A
B
D
C
A
C
B
D
...
```
이런 결과를 낼 수 있다. 여기서 735ㅁ의 숫자들은 PID라는 process ID를 뜻한다. 즉, 7353, 7354, 7355, 7356이라는 이름의 프로세스 4개가 동시에 돌아가고 있다는 것이다.<br>

분명 CPU는 하나지만 프로그램 4개가 동시에 실행되는 것 처럼 보이는 환상(illusion)을 만들어 낸다. 이렇게 하나의 CPU가 무한개의 CPU가 존재하는 것처럼 변환하여 동시에 많은 수의 프로그램을 실행시키는 것을 CPU 가상화(virtualizing the CPU)하고 한다. 이렇게 프로그램을 실행, 정지, 탐색을 하기 위해서는 API가 필요하다는 것을 알 수 있고 이런 작업 들을 하기위한 운영체제의 정책(policy)에 맞는 기본적인 기법을 다루는 법에 대해서 배우게 될 것이다.

# 메모리 가상화(Memory virtualization)