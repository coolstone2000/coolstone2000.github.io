---
layout: single
title: "Operating sysetem - CUP_scheduling"
categories: Operating_system
tags: OS
toc: true
author_profile: false
---

# 워크로드에 대한 가정

* 워크로드(work load): 일련의 프로세스들이 실행하는 상황<br><br>
우리는 시스템에서 실행 중인 프로세스 혹은 작업에 대해 다음과 같은 가정을 한다.
1. 모든 작업은 **같은 시간 동안 실행**
2. 모든 작업 **동시에 도착**
3. 각 작업은 시작되면 **완료될 때까지 실행**
4. 모든 작업은 **CPU만 사용** (입출력을 수행하지 않는다.)
5. 각 작업의 **실행 시간은 사전에 알려져 있다.**

# 스케줄링 평가 항목

이렇게 가정된 워크로드로 만든 스케줄링이 있을 것이다. 그런데 이 스케줄링중 어떤게 더 좋은지 평가하는 기준이 필요할 것이다. 그래서 우리는 **스케줄링 평가 항목(scheduling metric)**을 결정해야 한다. 이 평가 기준은 여러개가 존재한다.<br>

## 반환 시간(turnaround time)
* $T_{turnaround}$ : 반환 시간
* $T_{completion}$ : 종료 시간(마지막 것이 도착한 시간)
* $T_{arrival}$ : 도착 시간(맨 처음 도착한 시간)

<center><span style="font-size:200%"> $T_{turnaround} = T_{completion} - T_{arrival}$ </span></center>