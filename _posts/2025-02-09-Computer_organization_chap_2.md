---
layout: single
title: "CO - chapter 2 Instructions: Language of the Computer"
categories: Computer_organization
tags: CO
toc: true
author_profile: false
---
하드웨어가 알아들을수 있는 컴퓨터 언어를 명령어(instruction)이라고 한다. 이번 장에서는 RISC-V의 명령어에 대하여 알아볼 것이다. 

# 하드웨어 연산

<center><img src="/images/CO/chap2_assemble.png" width = "700"></center><br>

RISC-V 구조는 x0~x31까지 총 32개의 register를 가지고 있고 각 register안에는 64bit의 data가 들어갈 수 있다. 그리고 메모리에는 $2^{61}$개의 word가 들어갈 수 있다. (Word: 32bit, Doubleword: 64bit)
