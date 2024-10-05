---
layout: single
title: "Operating sysetem - Virtualization_processes"
categories: Operating_system
tags: OS
toc: true
author_profile: false
---

# Process

프로세스(process)란 실행 중인 프로그램으로 정의한다. 그런데 사용자는 하나 이상의 프로그램을 동시에 실행 하기를 원한다. 운영체제는 CPU를 가상화하여 이런 환상을 만들어낸다. 하나 또는 소수의 CPU로 여러 개의 가상 CPU가 존재하는 환상을 만들어내는 것이다. 이 방밥을 시분할(time sharing)이라고 한다. 이 기법은 CPU를 공유하기 때문에 각 프로세스의 성능은 많이 분할 할 수록 낮아진다. 

프로세스의 구성 요소를 이해하기 위해서는 하드웨어 상태(machine state)를 이해해야하는데 이때 하드웨어 상태를 읽거나 갱신하는데 중요한 구성 요소는 메모리와 레지스터이다. 명령어가 메모리에 저장되고 데이터 또한 메모리에 저장되게 된다. 그리고 이러한 명령어들은 레지스터를 직접 읽거나 갱신을 하여 사용한다. 이 레지스터들 중 특별한 것들이 있는데 프로그램 카운터(program counter, PC)또는 명령어 포인터(instruction pointer, IP)라고 불리는 어느 명령어가 실행 중인지 알려주는 레지스터와 스택 포인터(stack pointer)와 프레임 포인터(frame pointer) 등이 있다.