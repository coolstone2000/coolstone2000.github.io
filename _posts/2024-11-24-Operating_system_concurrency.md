---
layout: single
title: Operating system - Concurrency
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
앞에서는 virtualization과 같은 것을 배웠다. 이번 장에서는 프로세스를 위한 새로운 개념인 thread에 대해 배울 것이다. 프로그램이 한 순간에 하나의 명령어만 실행하는 고전적인 관점에서 벗어나 멀티 쓰레드 프로그램은 하나 이상의 명령을 실행하게 한다. 쓰레드는 주소 공간을 공유한다. 여기에서도 context switch가 일어나야 한다. 각 register의 상태를 저장하고 실행을 위해 복원해야한다. 프로세스는 process control block(PCB)라는 자료구조에 프로세스 상태를 저장했었는데 thread는 **TCB(Thread Control Block)**에 상태를 저장하게 된다. 프로세스와 쓰레드의 큰 차이점은 page table을 전환할 필요가 없다는 것이다. 
<center><img src="/images/OS/th_pro.png" width = "700"></center><br>
Thread는 주소공간을 공유한다. 여기서 눈 여겨 봐야하는 것은 stack이다. 
<center><img src="/images/OS/con_thread.png" width = "700"></center><br>
Thread의 개수에 따라 stack의 개수도 늘어나게 된다. 이에 대해서는 나중에 다룰 것이다.

# ◼︎ Why Use Threads?

왜 쓰레드를 사용하려는 것일까? 크게 2가지의 이유가 있다.

1. 병렬 처리가 간단하다
2. 느린 I/O에 의해 프로그램 수행이 차단되는 것을 막기 위해

# ◼︎ Thread creation

```c
#include <stdio.h>
#include <assert.h>
#include <pthread.h>

void *mythread(void *arg) {
    printf("%s\n", (char *) arg);
    return NULL;
}
s
int main(int argc, char *argv[]) {
    pthread_t p1, p2;
    int rc;
    printf("main: begin\n");
    // 쓰레드를 만듭니다.
    pthread_create(&p1, NULL, mythread, "A");
    pthread_create(&p2, NULL, mythread, "B");
    // 쓰레드를 실행하고 완료되길 기다립니다.
    pthread_join(p1,NULL);
    pthread_join(p2,NULL);
    printf("main: end\n");
    return 0;
}
```
이걸 실행해보면 AB가 나오기도 하고 BA가 나오기도 한다. 이는 일어난 과정을 보면 알 수 있다.
<center><img src="/images/OS/con_trace.png" width = "700"></center><br>
뭐가 먼저 할지는 랜덤이다. 아무도 모른다. 그래서 여러가지의 경우의 수가 나오게 되는 것이다. 

# ◼︎ Shared data

```c
#include <stdio.h>
#include <assert.h>
#include <pthread.h>

static volatile int counter = 0;

void *mythread(void *arg) {
    printf("%s: begin\n", (char *) arg);
    int i;
    // 전역변수 counter를 1씩 100만번 증가시킵니다.
    for (i = 0; i < 1000000; i++){
        counter += 1;
    }
    printf("%s: done\n", (char *) arg);
    return NULL;
}

int main(int argc, char *argv[]) {
    pthread_t p1, p2;
    printf("main: begin (counter = %d)\n", counter);
    pthread_create(&p1, NULL, mythread, "A");
    pthread_create(&p2, NULL, mythread, "B");

    pthread_join(p1,NULL);
    pthread_join(p2,NULL);

    printf("main: done (counter = %d)\n",counter);
    return 0;
}
```
이번엔 이 코드를 실행할건데 100만 + 100만이라서 counter를 print하면 200만이 나올것 같은데 순서도 지멋대로고 counter도 200만보다 작은 숫자가 나오게 된다. 왜 이런 것일까?

```
mov 0x8049a1c, %eax
add $0x1, %eax
mov %eax, 0x8049a1c
```
어셈블리 어를 이용하여 좀 봐보면 된다.
<center><img src="/images/OS/con_shared.png" width = "700"></center><br>

맨 마지막 줄이 떨어져서 실행이 되기 때문에 이미 51로 늘어났는데 그것을 mov시켰기에 52가 아닌 그냥 51이 나오는 것이다. 이런 상태를 **race condition**이라고 하고 여기서 공유되는 값을 **critical section**이라고 한다. 어느 쓰레드가 critical section에 접근하면 다른 스레드는 오지 못하게 하는 **mutal exclusion**이 필요하다.

이는 atomicity라는 것을 이용해서 해결 할 수 있다. 3줄이던 것을 한줄로 만들어버리는 것이다.
```
memory-add 0x8049a1c, $0x1
```
뒤에서는 이러한 것들에 대한 내용을 다룰 것이다.