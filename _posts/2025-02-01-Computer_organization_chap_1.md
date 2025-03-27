---
layout: single
title: "CO - chapter 1 Computer Abstraction and Technology"
categories: Computer_organization
tags: CO
toc: true
author_profile: false
---

우선 컴퓨터 구조를 시작하기 전에 비트수의 단위에 대한 표를 하나만 보겠다.

<center><img src="/images/CO/byte.png" width = "700"></center><br>

공부에 참고한 책은 Computer Oraganization And Design - The HardWare/Software interface, RISC-V Edition(David A. Patterson)으로 뒤에 나올 operand와 같은 내용들을 RISC-V의 기준으로 할 것이다. 

# ◼︎ 컴퓨터 구조 분야의 일곱가지 위대한 아이디어

컴퓨터가 발전하는데에 있어 기여를 크게한 7개의 아이디어에 대해 알아볼 것이다.

1. 추상화(Abstraction)<br>
    하위 계층의 세부적인 것들이 상위 계층에 보이지 않게 하는 것이다. <br>
    ex) low-level language, high level language<br>
2. 자주 생기는 일을 빠르게(Common case fast)<br>
    자주 일어나는 일을 빠르게 하면 성능이 개선된다.<br>
3. 병렬성(Parallelism)<br>
    동시에 작동하면 성능이 개선된다.<br>
4. 파이프라이닝(Pipelining)<br>
    병렬성의 특별한 형태이다.<br>
5. 예측(Prediction)<br>
    예측이 맞으면 빠르게 생략 가능하다.<br>
6. 메모리 계층구조(Memory heirarchy)<br>
    위에 있을수록 빠르지만 용량이 작고 아래로 갈수록 느리지만 용량이 큰 구조<br>
7. 여유분을 이용한 신용도 개선(Dependability)<br>
    소자가 고장나더라도 대치할 수 있는 여유분이 있으면 신용도가 올라간다 -> Moore's law<br>

# ◼︎ 프로세와 메모리 생산 기술

트랜지스터 - 전기로 제어되는 on/off 스위치<br>
집적회로 - 여러개의 트랜지스터를 집적시킨 칩<br>
VSLI - 초대규모집적회로<br>

<center><img src="/images/CO/chip_manu.png" width = "700"></center><br>

이런 과정을 통해 반도체를 만들게 되는데 이 반도체는 수율과 같은 요소로 판단을 하게 된다.

> **Cost per die(다이 하나당 가격)** = Cost per wafer(웨이퍼당 가격) / {Dies per wafer(웨이퍼 하나에 있는 다이의 개수) X Yield(수율)}<br>
> **Dies per wafer(웨이퍼 하나에 있는 다이의 개수)** = Wafer area(웨이퍼의 면적)/Die area(다이의 면적)<br>
> **Yield(수율)** = 1/(1+ Defects per area(면적에 있는 결함 개수) X Die area/2$)^2$<br>