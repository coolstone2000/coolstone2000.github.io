---
layout: single
title: Operating system - Paging
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
앞에서 보았듯 공간을 다양한 크기의 청크로 분할하면 공간이 fragmented되게 된다. 그래서 동일 크기의 조각으로 분할하는 방법을 생각해볼 수 있다. 이를 paging이라고 한다. 고정 크기의 단위를 page라고 하고 이에 대응되는 물리 메모리를 page frame이라고 한다. 다음은 16 byte의 page로 이루어진 가상 주소 공간과 16byte의 page frame을 갖는 물리 메모리의 주소 공간의 그림이다.
<center><img src="/images/OS/pg_addr.png" width = "1000"></center><br>
이렇게 Paging의 장점은 flexibity와 simplicity이다. 주소 공간의 각 가상 페이지에 대한 물리 메모리 위치 기록을 위하여 운영체제는 프로세스마다 **page table**이라는 자료구조를 유지한다. 주요 역할은 가상 주소 공간의 가상 페이지 주소 변환 정보를 저장하는 것으로 위의 예시에서는 ( VP 0 → PF 3 ) , ( VP 1 → PF 7 ) , ( VP 2 → PF 5 ), ( VP 3 → PF 2 )이다. 이렇게 virtual page number를 저장하고 offset도 저장하기 위해서 virtual address위치에 따라 구분할 수 있게 해야 한다.
<center><img src="/images/OS/pg_addr_tran.png" width = "800"></center><br>
그래서 이렇게 앞의 2비트는 VPN을 저장하고 뒤에는 offset을 저장하게 하였다. 그리고 이것을 physical address와 이어주기 위해 translation이 필요하다. 이 translation을 통해 VPN은 PFN(page frame number)로 변환되고 offset은 그대로 들어오게 된다.

# ◼︎ 페이지 테이블이 저장되는 곳

페이지 테이블은 세그멘트 테이블이나 베이스-바운드 쌍에 비해 매우 큰편이다. 그래서 이 정보를 저장하기 위해 **page table entry(PTE)**마다 필요한 byte만큼 할당받게 되는데 이로 인해 굉장히 많은 메모리를 사용하게 된다. 프로세스가 늘으면 그 배수만큼 메모리도 할당되야된다. 그래서 MMU에 저장되는 것이 아닌 physical memory에 저장되어있다. 그래서 운영체제가 관리하는 곳에 같이 저장되어있다.
<center><img src="/images/OS/pg_table.png" width = "700"></center><br>
그림을 보면 PF0에 페이지 테이블이 있다.

# ◼︎ 페이지 테이블을 구성하는 요소

페이지 테이블은 가상 주소(VPN)를 물리주소(PFN)으로 매핑하는 사용하는 자료구조이다. 원하는 PFN을 찾기 위해 VPN으로 배열에 접근하고 그 항목의 PTE를 검색하는 방식이다. 이 PTE는 다음과 같은 bit들로 이루어져있다.

1. **Valid bit**: 특정 변환의 유효 여부를 나타낸다
2. **Protection bit**: 페이지가 읽을수 있는지, 쓸 수 있는지, 실행될 수 있는지 등을 표시한다
3. **Present bit**: 이 페이지가 물리 메모리에 있는지 혹은 디스크에 있는지 사용된다
4. **Reference bit**: 페이지가 접근되었는지 추적할 때 사용한다

<center><img src="/images/OS/pg_pte.png" width = "700"></center><br>

# ◼︎ Paging: 느리다

페이지 테이블이 크기가 매우 크면 당연히 처리 속도가 느려지게 된다. 
<center><img src="/images/OS/pg_mem_trace.png" width = "700"></center><br>
보면 VPN(page table[1])에서 PFN(page table[39])로 왔다갔다 하기 위해서 mov가 생기고 memory access가 많이 일어나는 것을 알 수 있다. 이는 메모리에 접근하기 위해 2번의 접근이 필요하게 하고 테이블 크기가 커질 수록 속도가 저하된다. 다음 장에서는 이를 해결해볼 것이다.