---
layout: single
title: "Operating sysetem - Virtualization_processes"
categories: Operating_system
tags: OS
toc: true
author_profile: false
---

# Process

**프로세스(process)**란 실행 중인 프로그램으로 정의한다. 그런데 사용자는 하나 이상의 프로그램을 동시에 실행 하기를 원한다. 운영체제는 CPU를 가상화하여 이런 환상을 만들어낸다. 하나 또는 소수의 CPU로 여러 개의 가상 CPU가 존재하는 환상을 만들어내는 것이다. 이 방밥을 **시분할(time sharing)**이라고 한다. 이 기법은 CPU를 공유하기 때문에 각 프로세스의 성능은 많이 분할 할 수록 낮아진다. 이 시분할은 자원 공유를 운영체제가 사용하는 가장 기본 기법 중 하나로 이와 대응 되는 개념으로 **공간 분할(space sharing)**이 있다.

프로세스의 구성 요소를 이해하기 위해서는 **하드웨어 상태(machine state)**를 이해해야하는데 이때 하드웨어 상태를 읽거나 갱신하는데 중요한 구성 요소는 메모리와 레지스터이다. 명령어가 메모리에 저장되고 데이터 또한 메모리에 저장되게 된다. 그리고 이러한 명령어들은 레지스터를 직접 읽거나 갱신을 하여 사용한다. 이 레지스터들 중 특별한 것들이 있는데 **프로그램 카운터(program counter, PC)**또는 **명령어 포인터(instruction pointer, IP)**라고 불리는 어느 명령어가 실행 중인지 알려주는 레지스터와 **스택 포인터(stack pointer)**와 **프레임 포인터(frame pointer)** 등이 있다.

# Process API

API가 제공하는 기본 기능은 다음과 같다.
1. 생성(Create): 프로세스를 생성할 수 있는 방법을 제공한다. 쉘에 명령어를 입력하거나 아이콘을 더블-클릭하여 프로그램을 실행시키는 것 자체가 운영체제가 새로운 프로세스를 생성하는 방법이다.
2. 제거(Destroy): 생성 프로그램이 있듯 강제로 제거할 수 있는 인터페이스를 제공해야한다. 보통은 실행된 후 할 일을 다하면 스스로 종료하지만 그렇지 않은 프로세스는 사용자가 직접 제거할 수 있는 API가 필요하다.
3. 대기(Wait): 실행 중지 전에 기다릴 필요가 있기 때문에 이에 관한 API가 존재한다.
4. 각종 제어(Miscellaneous Control): 프로세스를 일시정지하거나 재개하는 것과 같은 여러 제어 기능이 있다.
5. 상태(Status): 프로세스 상태 정보를 얻어내는 인터페이스가 제공된다. 얼마나 실행 되었는지와 어떤 상태에 있는지 등이 포함된다.

# Process Create

<center><img src="/images/OS/pro_crt.png" width="500" height="700"></center>
프로그램 실행을 위해 운영체제가 가장 먼저 하는 일은 위의 그림처럼 프로그램 코드와 정적 데이터(static data)를 메모리(프로세스 주소)에다 **탑재(load)**하는 것이다. 초기 운영체제들은 프로그램을 실행하기 전코드와 데이터 모두를 메모리에 탑재 하였는데 이것은 성능을 낮추었다. 이제는 프로그램을 실행할 때 필요한 부분만 메모리에 탑재한다. 이것은 **페이징(paging)**과 **스와핑(swaping)**과 관련있다. 우선 여기서 이해해야 하는 것은 **프로그램의 중요 부분을 디스크에 메모리로 탑재해야 한다는 것**이다.<br>
메모리로 탑재된 후 운영체제는 **프로그램의 실행시간 스택(run-time stack)을 할당**시켜야 한다. 메인(main)함수의 경우 argc(argument count , 데이터 개수)와 argv(argument variable, 저장주소)를 사용하여 스택을 초기화한다.<br>
운영체제는 **프로그램의 힙(heap)을 위한 메모리 영역을 할당**한다. 힙(heap)은 동적으로 할당된 데이터를 저장하기 위해 사용된다. malloc()을 호출하여 필요한 공간을 요청하고 free()를 호출하여 사용했던 공간을 반환하여 다른 프로그램이 사용될 수 있도록 한다. 힙은 연결리스트, 해시 테이블, 트리 등 크기가 가변적인 자료 구조를 사용할 수 있게 하고 프로그램이 실행되면 malloc() 라이브러리 API가 메모리를 요청하고 운영체제는 이를 충족하도록 메모리를 할당한다.<br>
운영체제는 입출력과 관계된 초기화 작업을 수행한다. 기본적으로 표준 입력(STDIN), 표준 출력(STDOUT), 표준 에러(STDERR) 장치에 해당하는 세 개의 파일 디스크립터(file descriptor, 리눅스 혹은 유닉스 계열의 시스템에서 프로세스(process)가 파일(file)을 다룰 때 사용하는 개념으로, 프로세스에서 특정 파일에 접근할 때 사용하는 추상적인 값)를 갖는다.<br>
운영체제가 코드와 정적 데이터를 메모리에 탑재하고, 스택과 힙을 생성하고 초기화하고, 입츨력 셋업과 관계된 다른 작업을 마치게 되면 프로그램 실행을 위한 준비를 마치게 된다. 이 이후 CPU에 새로 생성된 프로세스를 넘기고 프로그램이 실행되는 것이다.<br>

# Process Status

프로세스 상태를 단순화 하면 다음 세 상태 중 하나에 존재할 수 있다.
* 실행(Running): 명령어를 실행하고 있는 상태
* 준비(Ready): 다른 프로세스를 실행하고 있는 등의 이유로 대기중인 상태
* 대기(Blocked): 다른 프로세스를 기다리는 동안 수행을 중단시키는 연산

입출력이 없을때 프로세스는 다음과 같다.<br>
<center><img src="/images/OS/pro_noin.png"></center>

그에 반해 입출력이 있을 때 프로세스는 다음과 같다.<br>
<center><img src="/images/OS/pro_in.png"></center>


이러한 결정은 스케줄러를 통해 운영체제가 결정을 내린다.

# Process Data structure

운영체제도 일종의 프로그램이기 때문에 다양한 정보를 유지하기 위한 자료 구조를 가지고 있다. 아래는 xv6 Proc구조를 간단하게 나타낸 것이다.
```
// 프로세스를 중단하고 이후에 재개하기 위해 xv6가 저장하고 복원하는 레지스터
struct context { 
	int eip; 
	int esp; 
	int ebx; 
	int ecx; 
	int edx; 
	int esi; 
	int edi; 
	int ebp; 
}; 
// 가능한 프로세스 상태
enum proc_state { UNUSED, EMBRYO, SLEEPING, 
				RUNNABLE, RUNNING, ZOMBIE }; 
// 레지스터 문맥과 상태를 포함하여 각 프로세스에 대하여xv6가 추적하는 정보
struct proc { 
	char *mem; // 프로세스 메모리 시작 주소
	uint sz; // 프로세스 메모리의 크기 
	char *kstack; // 이 프로세스의 커널 스택의 바닥 주소
	enum proc_state state; // 프로세스 상태
	int pid; // 프로세스 ID 
	struct proc *parent; // 부모 프로세스 
	void *chan; // 0이 아니면, chan에서 수면 
	int killed; // 0이 아니면 종료됨
	struct file *ofile[NOFILE]; //열린파일 
	struct inode *cwd; // 현재 디렉터리
	struct context context; // 프로세스를 실행시키려면 여기로 교환 
	struct trapframe *tf; // 현재 인터럽트에 해당하는 트랩 프레임
};
```
레지스터 문맥(register context) 자료구조는 프로세스가 중단되었을 대 해당 프로세스의 레지서터값들을 저장한다. 이 레지스터 값들을 복원하여 운영체제는 프로세스 실행을 재개하고 이 것을 문맥 교환(context switch)라고 한다. 코드를 보면 실행, 즌비, 대기 외에 다른 초기(initial)상태를 가지는 시스템이 잇는 것을 볼 수 있다. 프로세스는 종료되었지만 메모리에 남아 있는 최종(final)상태를 좀비(zombie)라고 부른다. 

# Process API

UNIX 시스템의 프로세스 생성에 대해 실제적인 측면을 알아 볼 것이다. UNIX는 프로세스를 생성하기 위하여 fork()와 exec() 시스템 콜을 사용하고 wait()는 프로세스가 자신이 생성한 프로세스가 종료되기 기다리기 원할 때 사용된다. 