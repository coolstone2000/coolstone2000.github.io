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
물리적 메모리(physical memory)는 바이트의 베열로 메모리를 읽고 쓰기 위해서는 주소와 데이터가 있어야 한다.
메모리는 프로그램이 실행되는 동안 항상 접근되는데 메모리 접근 하는 프로그램을 만들어 어떻게 되는지 보면 다음과 같다. 

```c
 #include <unistd.h>
 #include <stdio.h>
 #include <stdlib.h>
 #include“common.h ”
 int
 main(int argc, char *argv[])
 {
    int *p = malloc(sizeof(int)); // a1
    assert(p != NULL);
    printf(“(%d) memory address of p: %08x\n ”,
        getpid() , (unsigned) p); // a2
    *p = 0; // a3
    while (1) {
        Spin(1);
        *p = *p + 1;
        printf(“(%d) p: %d\n ”, getpid() , *p); // a4
    }
    return 0;
}
```
(a1)행에서는 메모리를 할당받고, (a2)행에서 그 할당 받은 메모리를 출력한다. (a3)행에서 그 메모리 첫 슬롯에 숫자 0을 넣고 1초 대기 후 그 주소의 데이터 값을 1씩 증가시키는 코드이다.

```
prompt> ./mem
(2134) memory address of p: 00200000
(2134) p: 1
(2134) p: 2
(2134) p: 3
(2134) p: 4
(2134) p: 5
∧C
```
코드를 한 번씩만 진행하면 메모리의 주소는 00200000로 하나하나씩 결과를 출력하고 있다.

```
prompt> ./mem &; ./mem &
[1] 24113
[2] 24114
(24113) memory address of p: 00200000
(24114) memory address of p: 00200000
(24113) p: 1
(24114) p: 1
(24114) p: 2
(24113) p: 2
(24113) p: 3
(24114) p: 3
(24113) p: 4
(24114) p: 4
. . .
```
이것은 프로그램을 여러번 실행 시켰을 때이다. 주소는 0020000으로 같아서 물리적으로 같은 메모리가 쓰이지만 각각의 메모리를 사용하고 있는 것 처럼 보인다. 이것은 운영체제가 메모리 가상화(virtualizing memory)를 하기 때문이다. 그래서 각 프로세스는 자신만의 가상 주소 공간(virtual address space)를 가지게 된다.

# 병행성(Concurrency)
프로그램이 한번에 많은 일을 하거나 동시에 발생하는 문제들을 뱅행성 문제라고 한다. 이 문제는 운영체제 자체에서 발생하고 멀티 쓰레드에서도 나타난다.

```c
#include <stdio.h>
#include <stdlib.h>
#include "common.h"

volatile int counter = 0;
int loops;

void *worker(void *arg) {
	int i;
	for (i = 0; i < loops; i++) {
		counter = counter + 1;
	}
	pthread_exit(NULL);
}

int main(int argc, char *argv[]) {
	if (argc != 2) {
		fprintf(stderr, "usage: threads <loops>\n");
		exit(1);
	}
	loops = atoi(argv[1]);
	pthread_t p1, p2;
	printf("Initial value : %d\n", counter);
	Pthread_create(&p1, NULL, worker, NULL);
	Pthread_create(&p2, NULL, worker, NULL);
	Pthread_join(p1, NULL);
	Pthread_join(p2, NULL);
	printf("Final value : %d\n", counter);
	return 0;
}
```
각 쓰레드 p1, p2는 worker()라는 루틴을 루프만큼 실행을 하게 된다. 그래서 이 코드를 1000번의 루프를 가지고 실행을 시키면 counter가 어떻게 될까?

```
prompt> gcc −o thread thread.c −Wall −pthread
prompt> ./thread 1000
Initial value : 0
Final value : 2000
```
2개의 쓰레드가 각 1000번씩 도니까 2000이 된다. 그래서 N번 실행되면 counter가 2000이 된다는 것을 알 수 있다. 그런데 실제로는 그렇지 않다. 만약 loops의 값을 더 큰값으로 하면 어떻게 될 까?

```
prompt> ./thread 100000 
Initial value : 0 
Final value : 143012
prompt> ./thread 100000 
Initial value : 0 
Final value : 137298
```
분명 값을 10000으로 줬는데 20000이 되지 않는다. 이상해서 한번을 더 돌려 봐도 143012, 137298과 같은 이상한 숫자가 나온다.

이것은 명령어가 한 번에  하나씩 실행되는 것과 관련이 있다. counter는 총 3개의 명령어로 구성되어 있는데 이 명령어가 원자적(atomically)으로 동시에 3개가 실행되지 않기 때문에 이런 일이 발생하게 된다. 이래서 이 뱅행 프로그램이 올바로 작동하게 하기 위해 어떤 일을 해야하는지 나중에 알아보게 된다.

# 영속성(Persistence)

DRAM과 같은 장치는 데이터가 휘발성(volatile) 방식으로 저장되기 때문에 만약 전원이 끊기거나 고장 나게 된다면 데이터를 영속적으로 저장할 수 있는 하드웨어와 소프트웨어가 필요하다. 하드웨어는 SSD나 HDD같은 저장 장치를 쓰게 되고 이런 디스크를 관리하는 운영체제 소프트웨어를 파일 시스템(file system)이라고 한다.

```c
#include <stdio.h>
#include <unistd.h>
#include <assert.h>
#include <fcntl.h>
#include <sys/types.h>

int main(int argc, char *argv[])
{
    int fd = open("/tmp/file", O_WRONLY | O_CREAT | O_TRUNC, S_IRWXU);
    assert (fd > -1);
    int rc = write(fd, "Hello World!\n", 13);
    assert (rc == 13);
    close(fd);
    return 0;
}
```
다음은 "Hello World"를 포함한 파일 /tmp/file을 생성하는 코드이다. 여기서 프로그램은 운영체제를 3번 호출하게 된다. 첫째는 open() 콜(call)로 파일을 생성하고, 둘째는 write() 콜로 파일에 데이터를 쓰고, 셋째는 close() 콜로 파일을 닫는다. 이 시스템 콜(system call)들은 운영체제에서 파일 시스템(file system)에 전달된다. 

데이터를 디스크에 쓰기 위해서 운영체제가 실제로 하는 일이 무엇인지 궁금할 것이지만 그렇게 쉽지 않다. 이것들은 나중에 다루기로 하겠다.