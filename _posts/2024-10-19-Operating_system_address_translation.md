---
layout: single
title: Operating sysetem - Address translation
categories: Operating_system
tags: OS
toc: true
author_profile: false
---

CPU를 가상화 할 때 우리는 LDE(Limited Direct Execution)을 사용한다는 것을 알았다. 그런데 메모리 또한 비슷한 방식을 이용한다. 우리가 다룰 기법은 **하드웨어-기반 주소 변환(hardware-based address translation)** 혹은 **주소 변환(address translatino)**이라고 하는 것을 배울것이다. 주소 변환을 통해 하드웨어는 가상 주소를 정보가 실제로 존재하는 물리 주소로 변환할 수 있게 된다. 이런 일을 하기 위해서 운영체제는 메모리의 빈 공간과 사용 중인 공간을 항상 알고 있고 메모리 사용을 제어하고 관리하게된다. 그래서 우리가 하려는 것은 프로그램이 자신의 전용 메모리를 소유하고 그 안에 자신의 코드와 데이터가 존재한다는 **환상(illosion)**을 주는 것이다. <br>
<center><img src="/images/OS/ned_portal.gif" width = "500"></center><br>

# ◼︎ 가정

사용자 주소 공간은 물리 메모리에 연속적으로 배치되어야 한다고 가정한다. 그리고 주소 공간의 크기는 적당하다고 가정하자. 주소 공간은 **물리 메모리 크기보다 작으며** 각 주소 공간의 크기가 **같다고** 가정한다. 

# ◼︎ 사례

```c
void func() {
    int x = 3000;
    x = x + 3; // line of code we are interested in
    ...
```
이런 코드가 있다고 가정하자. 그러면 컴파일러는 이 코드르 어셈블리 코드로 변환할 것이다. 그것의 결과는 다음과 같다.
```
128: movl 0x0(%ebx), %eax ;load 0+ebx into eax
132: addl $0x03, %eax ;add 3 to eax register
135: movl %eax, 0x0(%ebx) ;store eax back to mem
```
x의 주소는 레지스터 ebx에 저장됐다는 가정이다. movl를 통해 범용 레지스터 eax에 0+ebx를 넣고 addl을 통해 3을 더해준다. 그러고 다시 ebx에 저장해 업데이트 시킨다. 변수 x의 값은 주소 15KB에 위치하고 초기 값은 3000이다. 그러면 다음과 같이 실행되게 된다.<br>

1. 주소 128의 명령어를 반입
2. 이 명령어 실행 (주소 15 KB에서 탑재)
3. 주소 132의 명령어를 반입
4. 이 명령어 실행 (메모리 참조 없음)
5. 주소 135의 명령어를 반입
6. 이 명령어 실행 (15 KB에 저장)

<center><img src="/images/OS/add_mem_exp.png" width = "500"></center><br>

프로그램에게 주소 공간은 주소 0부터 16KB까지 사용할 수 있다. 그런데 우리는 메모리 가상화를 하기 위해 프로세스를 물리 메모리 주소 0이 아닌 다른곳에 위치시키고 싶어한다. 그래서 어떻게 재배치할 것인가에 대해 고민해 봐야 한다. 위의 사진의 왼쪽은 가상 주소 공간의 메모리의 예시고 오른쪽은 가능한 물리 메모리 배치의 예시이다. 물리 메모리의 주소 0은 운영체제가 써야한다. 그리고 주소 공간 메모리는 32KB부터 들어가고 그 옆은 미사용으로 비어있다.

# ◼︎ 동적(하드웨어-기반) 재배치 (Dynamic relocation)

**동적 재배치(Dynamic relocation)**은 **베이스와 바운드(base and bound)**라는 아이디어를 이용한 것이다. 각 CPU마다 2개의 하드웨어 레지스터인 **베이스(base)**와 **바운드(bound) or 한계(limit)**가 있다. 프로그램은 주소 0에 탑재되는 것 처럼 작성되고 컴파일 되는데 운영체제는 실제로 탑재될 물리 메모리 위치를 결정하고 그 시작 지점을 베이스 레지스터로 그 주소로 지정하게 된다. 

>  Physical address = virtual address + base

(0 $\leq$ virtual address $\leq$ bounds)
는 물리적인 주소를 계산하는 공식이다.<br>

```128: movl 0x0(%ebx), %eax ;```를 보면 PC(프로그램 카운터)가 128이다. 만약 베이스 레지스터의 값이 32KB(32768)일 때 실제 물리 주소는 터해진 32896의 물리 주소를 얻게 될 것이다. 그리고 
```c 
x = 3000
```
를 실행해야 하기 때문에 15KB + 32KB = $7KB가 된다. 이렇게 주소 공간이 이동되기 때문에 **동적 재배치(dynamic relocation)**이라고 불린다. 근데 빠진게 있다. 대체 바운드 레지스터는 어디다 쓰는 걸까? 바운드 레지스터는 보호를 지원하기 위해 존재하는 것이다. 가상 주소가 바운드 안에 있는지 계속 확인하는 것이다. 그래서 베이스와 바운드 레지스터는 CPU에 존재하는 하드웨어 구조이며 주소 변환에 도움을 주는 프로세서의 일부를 **메모리 관리 장치(Memoory Management Unit, MMU)라고 불린다. <br>

# ◼︎ 하드웨어 지원: 요약

CPU와 momory에서 요구하는 지원을 요약하면 다음과 같다. 
<center><img src="/images/OS/os_hardware.png" width = "500"></center><br>
위는 하드웨어가 지원해 줘야 하는 것들이다. 그런데 운영체제가 요구하는 것들이 있다. 그것은 다음과 같다.
<center><img src="/images/OS/OS_required.png" width = "500"></center><br>

동적 재배치가 될 때 제한된 실행 프로토콜은 다음과 같다.
<center><img src="/images/OS/LDR.png"></center><br>