---
layout: single
title: Operating sysetem - Segmentation
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
지금 우리가 배운건 베이스와 바운드 레지스터를 이용해 주소 공간 전체를 메모리에 탑재한다. 이 방식은 스택과 힙 사이의 공간이 사용되지 않더라도 물리 메모리를 차지하고 있다. 그렇기 때문에 메모리 낭비 **(wasteful)** 가 심하다. 그리고 주소 공간이 물리 메모리보다 클 때 실행이 메우 어렵기 때문에 베이스 바운드 방식은 유연성이 없다 **(not as flexible)**. 
<br>

# ◼︎ 세그멘테이션: 베이스/바운드의 일반화 (Generalized Base/Bound)

위의 문제를 해결하기 위한 방법은 **segmentation**이다. 이 방식은 하나의 베이스와 바운드 쌍이 존재하는 것이 아닌 주소 공간의 논리적인 세그멘트마다 베이스와 바운드 쌍이 존재하는 것이다(**have a base and bounds pair per
logical segment of the address space**).

* Segment: 특정 길이를 가지는 연속적인 주소 공간(**a contiguous portion of the address space of a particular length**)
    - 코드
    - 스택
    - 힙

각 segment를 물리 메모리의 다른 위치에 배치할 수 있고 사용되지 않는 가상 주소 공간이 물리 메모리를 차지하는 것을 방지할 수 있다. 

<center><img src="/images/OS/seg_mem_add.png" width = "200"><img src="/images/OS/seg_mem_space.png" width = "300"></center><br>

Segement|Base|Size
:---:|:---:|:---:
코드     |32KB|2KB  
힙      |34KB|2KB 
스택     |28KB|2KB 

Offset은 Address - logical bass이다. 그래서 저장되는 물리 주소를 알고 싶으면 Offset + memory bass를 더하면 되는 것이다. 예시를 들어보자 가상 주소가 100일 때는 code segment에 속하고 segment의 offset은 100이 되고 물리 주소는 32B+100이 된다. 하지만 가상 주소가 4200인 heap을 보자. 이거는 아무생각 없이 34B+4200을 하게되면 틀리게 된다. 4200은 offset이 아니기 때문이다. 제대로 구하려면 4200 - 4KB = offset이 되는 것이다. 그래서 주소가 4200인 heap은 34KB + 4200 - 4KB = 30KB + 4200이 되는 것이다. <br>
이렇게 구하면 될 것 같지만 만약 힙이 7KB같은 잘못된 주소로 접근하게 되면 어떻게 되는 것일까? 이러면 주소가 벗어났다는 것을 하드웨어가 감지하고 운영체제에서 트랩을 발생시켜 프로세스를 종료할 것이다. 이것을 **segment violation** 또는 **segment fault**라고 한다.<br>

# ◼︎ Segment 종류의 파악

방금 우리는 사실상 그 주소가 어떤 종류의 segment를 가지는지 알고 주소를 찾았다. 그런데 실제로는 미리 알 수 없다. 그래서 이것을 구별해 줘야 한다.