---
layout: single
title: Operating system - Locks
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
앞에서 락에 대해 간단히 다뤘는데 이번 장에서는 조금 더 자세히 다뤄볼 것이다. 락은 동시성 프로그래밍을 할때 쓰레드에서 발생하는 공유자원에 여러 스레드가 동시에 접근 하는 문제를 해결하는 방법이다. Concurrency에서 명령을 atomically하게 수행하고 싶지만 프로세서에 interrupt 때문에 atomically하게 수행하지 못한다. 그래서 lock을 사용하는 것이다.

# ◼︎ Locks: The basic idea

```c
lock_t mutex;

lock(&mutex);
balance = balance + 1;
unlock(&mutex);
```

위의 코드에서 balance는 critical section에 접근하는데 lock과 unlock사이에 넣어줘서 접근을 제한하였다. 락 변수 mutex는 available(unlocked)이거나 acquired상태를 가지게 된다. 이 acquired 상태의 thread는 owner라고 한다.
<center><img src="/images/ML/owner.jpg" width = "300"></center>~~오창섭의 정상화~~<br> 

# ◼︎ Pthread lock

왜 mutex일까? 이는 쓰레드간에 일어나는 mutual exclusion을 뜻한다. 그래서 위의 코드를 POSIX 라이브러리 코드로 바꾸면 다음과 같이 된다.
```c
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

pthread_mutex_lock(&lock);
balance = balance + 1;
pthread_mutex_unlock(&lock);
```

# ◼︎ Evaluating lock

어떤 lock이 좋은지 판단하기 위해서는 3가지를 고려하게 된다.

1. **Mutual exclusion**: critical section에 여러 쓰레드가 들어가지 않도록 필수적이다
2. **Fairness**: 공평하게 lock을 얻을 수 있나? 우선순위에서 밀려 특정 스레드가 계속해서 lock을 획득하지 못하는 상황을 starve라고 한다.
3. **Performance**: 스레드가 한 개만 존재하면 lock을 사용하는게 오히려 성능 저하를 시킨다. 그래서 이런 불필요한 lock이 일어나지 않는지 판단해야한다.

# ◼︎ Controlling interrupt

원자성을 가지지 못하는 이유는 interrupt때문이라고 했다. 그래서 이 interrupt를 잠시 비활성화 할 수 있다.
```c
// lock을 획득 할 땐 인터럽트를 무시하도록 만듭니다.
void lock() {
    DisableInterrupts();
}

// unlock 할 때는 다시 인터럽트를 받도록 만듭니다.
void unlock() {
    EnableInterrupts();
}
```
이건 문제가 많은 방식이다. 첫째로는 스레드가 신뢰성이 높지 않다는 것. 두번째는 멀티 프로세서에서는 작동하지 않는다는 것. 세 번째는 인터럽트를 비활성화 시키는것이 문제 그 자체라는 것. 마지막으로는 효율성이 좋지 않다.

# ◼︎ A Failed Attempt: Just Using Loads/Stores

Flag를 이용하는 방법이 있다. Flag가 0이면 lock이 없는거고 1이면 있다는 것이다. 그래서 이걸 구현하면 다음과 같다.
```c
typedef struct __lock_t { int flag; } lock_t;

void init(lock_t *mutex) {
    mutex->flag = 0;
}

void lock(lock_t *mutex) {
    // mutex flag가 1인 경우엔 아무것도 안하고 무한루프만 돕니다.
    while(mutex->flag == 1)
    
    // while문을 벗어나면 mutex flag를 1로 수정하여 lock을 얻습니다.
    mutex->flag = 1;
}

void unlock(lock_t *mutex) {
    mutex->flag = 0;
}
```
그런데 이 방법은 틀렸다.
<center><img src="/images/ML/lk_flag.png" width = "700"></center><br>

두 개의 쓰레드가 lock을 얻어야 하는데 보면 flag가 두 쓰레드 모두에 1이 중복으로 들어갔다. 이는 mutual exclusion(flag == 0)선언이 안됐고 spin waiting으로 인해 context switch가 일어나 시간을 더 많이 쓰게 된다.

# ◼︎ Building Working Spin Locks with Test-And-Set

우선 코드는 이렇다.
```c
typedef struct __lock_t { int flag; } lock_t;

void init(lock_t *lock) {
    lock->flag = 0;
}

int TestAndSet(int *old_ptr, int new) {
    int old = *old_ptr;
    *old_ptr = new;
    return old;
}

void lock(lock_t *lock) {
    // TestAndSet의 반환값이 1일 경우에만 while 탈출합니다.
    while(TestAndSet(&lock->flag, 1) == 1)
    
    // while문을 벗어나면 lock flag를 1로 수정하여 lock을 얻습니다.
    lock->flag = 1;
}

void unlock(lock_t *lock) {
    lock->flag = 0;
}
```

TestAndSet이 atomic하기 때문에 수정과 반환을 아무 방해 받지 않고 수행하기 때문에 이 것을 spin wait를 사용하는 spin lock이라고 한다. 위의 평가 요소로 평가하면 mutual exclusion은 잘 수행하지만 fairness는 좋지 않다. 그리고 performance는 여러개의 CPU가 있는 상황일 때만 좋다.

# ◼︎ Compare-And-Swap & Load-Linked and Store-Conditional

시스템에서 지원하는 compare-and-swap 또는 Load-Linked and Store-Conditional 명령어를 사용하는 방법도 있다.

```c
int CompareAndSwap(int *ptr, int expected, int new) {
    // 기존 값을 original에 저장합니다.
    int original = *ptr;
    // 만약 기존 값과 expected 값이 같다면 ptr의 값을 new로 수정합니다.
    if(original == expected)
        *ptr = new;
    // 기존 값을 반환합니다.
    return original;
}

void init(lock_t *lock) {
    lock->flag = 0;
}

void lock(lock_t *lock) {
    while(CompareAndSwap(&lock->flag, 0, 1) == 1)
}

void unlock(lock_t *lock) {
    lock->flag = 0;
}
```

```c
int LoadLinked(int *ptr) {
    return *ptr
}

int StoreConditional(int *ptr, int value) {
    if(이코드가 실행될 때까지 *ptr에 변화가 없다면) {
    // 그제서야 *ptr의 값 변경
        *ptr = value;
        return 1;
    } else {
        return 0;
    }
}

void lock(lock_t *lock) {
    while(1) {
        // flag 값이 1인지 확인합니다. 만약 아니라면 spin
        while (LoadLinked(&lock->flag) == 1)
            ;
        // flag 값이 0이므로 lock을 획득 가능하고
        // flag 값을 1로 다시 설정하는데 StoreConditional 명령어를 사용합니다.
        if (StoreConditional(&lock->flag, 1) == 1)
            return;
    }
}

void unlock(lock_t *lock) {
    lock->flag = 0;
}
```

# ◼︎ Fetch-And-Add

Turn이라는 개념을 도입해 모든 스레드가 lock을 얻게 하는 방법이다. Ticket을 받아 번호표 느낌으로 turn이 1씩 늘어 해당 turn값을 가진 thread가 lock을 얻는 방식이다.

```c
int FetchAndAdd(int *ptr) {
    int old = *ptr;
    *ptr = old + 1;
    return old;
}

typedef struct __lock_t {
    int ticket;
    int turn;
} lock_t;

void lock_init(lock_t *lock) {
    lock->ticket = 0;
    lock->turn = 0;
}

void lock(lock_t *lock) {
    // 자신의 티켓 번호를 받습니다.
    int myturn = FetchAndAdd(&lock->ticket);
    // lock의 turn과 자신의 티켓이 같을 때까지 spin
    while (lock->turn != myturn)
        ;
}

// unlock을 하게 되면 turn+1을 하여 특정 스레드에게 lock 획득 권한을 줍니다.
void unlock(lock_t *lock) {
    lock->turn = lock->turn + 1;
}
```

# ◼︎ A Simple Approach: Just Yield

하드웨어의 지원만 받던 spin lock은 잘 작동하지만 spin wait라는 스레드를 lock을 얻을 때 까지 실행해야 하는 문제가 있다. 그런데 spin wait는 성능 저하를 발생시킨다. 그래서 이것을 OS에서 제공하는 tool로 간단하게 해결할 수 있다.

```c
void init() {
    flag = 0;
}

void lock() {
    while(TestAndSet(&flag, 1) == 1)
        yield();
}

void unlock() {
    flag = 0;
}
```