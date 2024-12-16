---
layout: single
title: Operating system - Thread API
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
Thread API의 주요 부분들을 간략하게 다뤄볼 것이다. 운영체제가 쓰레드를 생성하고 제어하는데 어떤 인터페이스를 제공해야할까?

# ◼︎ 쓰레드 생성 (Thread creation)

```c
#include <pthread.h>
int pthread_create(pthread_t      *thread,    // 스레드에 대한 정보
             const pthread_attr_t *attr,      // 스레드의 속성
                   void           *(*start_routine)(void *), // 스레드가 할 일
                   void           *arg);      // arguments
```

쓰레드를 생성하기 위해서는 위의 인터페이스가 무조건 필요하다. 우선 *thread는 쓰레드와 상호작용하는데 사용되어 초기화시 pthread_create()이 이 포인터를 전달한다. *attr은 쓰레드의 속성을 시정하는데 사용된다. 세번째는 쓰레드가 실행할 일(함수)를 알려준다. *arg는 실행될 함수에게 전달할 인자를 나타낸다.  

# ◼︎ 쓰레드 종류 (Thread completion)

thread를 만들었다면 종료하는 법도 알아야 한다. 그래서 다른 쓰레드가 작업을 완료할 때 까지 기다리는것이 필요하다. 이것은 ```pthread_join()```함수를 이용한다. 이 함수는 return된 값이 뭐였는지를 알려준다. 그래서 이 return값이 어떻게 반환될지를 생각해 줘야 한다. 쓰레드가 종료될 때는 스택을 초기화 시키게 되는데 만약 여기에 있던 정보를 반환하려고 하면 문제가 생긴다. 이렇게 ```pthread_create()```로 생성하고 바로```pthread_join()```를 호출하는 것은 굉장히 이상한 방법이다. 이와 같이 동작하지만 다른 쉬운 방법이 있는데 이것을 procedure call(절차 호출)이라고 한다. 그럼 join은 언제 쓰이냐고 하면 병렬 프로그램의 경우 종료 전 혹은 계산의 다음단계로 넘어가기 전에 병렬 수행이 완료됐다는 것을 확인할때 쓰인다.

# ◼︎ 락 (Locks)

<details><summary><b>나락도 락이다</b></summary><iframe width="471" height="838" src="https://www.youtube.com/embed/93uqlxGZ4zk" title="나락도 락이다" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></details>

앞에서 배웠듯 멀티쓰레딩을 하면 두 쓰레드가 겹칠때가 있었다. 그것을 critical section이라고 하였다. Lock은 이 구간을 해결할 수 있게 한다. Mutual exclusion을 이용하는데 함수는 다음과 같다.
```c
int pthread_mutex_lock(pthread_mutex_t *mutex);
int pthread_mutex_unlock(pthread_mutex_t *mutex);
```

만약 ```pthread_mutex_lock```이 호출 됐을 때 어떤 스레드도 락을 가지고 있지 않으면 이 쓰레드가 락을 얻어 critical section에 진입한다. 락이 있는 쓰레드가 존재하면 그 쓰레드가 unlock될때까지 호출에서 return하지 않게된다. 그냥 이 위의 두 함수만 쓰게 되면 문제가 발생하게 된다. 첫 번째 문제는 초기화를 하지 않았다는 것. 그래서 이는 PTHREAD_MUTEX_INITIALIZER를 이용한다. 두 번째 문제는 락과 언락을 호출할 때 에러 코드를 확인하지 않는다는 것이다. 그래서 위에보다는 아래있는 코드를 쓰게 된다.
```c
int pthread_mutex_trylock(pthread_mutex_t *mutex); 
int pthread_mutex_timedlock(pthread_mutex_t *mutex, struct timespec *abs_timeout);
```
이름에서 알 수 있듯 try를 해서 싪하면 알려준다. timedlock은 시간이 초과되면 이를 반환하게 된다. 

# ◼︎ 컨디션 변수 (condition variables)

한 쓰레드가 다른 쓰레드가 완뢰된 다음 수행되고 싶을 때 서로 상호작용을 해야한다. 시그널을 교환해야하는데 이때 condition variable을 사용한다. 기본적으로 다음 두 함수를 사용한다.
```c
int pthread_cond_wait(pthread_cond_t *cond, pthread_mutex_t *mutex); 
int pthread_cond_signal(pthread_cond_t *cond);
```

이름대로 wait는 기다리는 함수이고 signal은 신호를 주는 함수이다. 이를 사용하기 위해서는 wait를 사용하면 스레드가 어떤 신호를 받을때 까지 기다리게 되므로 lock이 걸려있다. 이게 unlock이 되면 signal 함수에 의해 어떤 신호를 전달 받으며 스레드가 실행된다.