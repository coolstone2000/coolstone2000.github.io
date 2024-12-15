---
layout: single
title: Operating sysetem - File system
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
vsfs(Very Simple File System)에 대해 배울 것이다. 파일 시스템은 순수한 소프트웨어로 CPU 가상화나 메모리 가상화랑은 다른다. 그때는 kernel mode가 필요했지만 vsfs는 그렇지 않다. 우선 파일 시스템은 두가지 측면이 있다.
1. **Data structure**: 디스크 상에 어떤 자료 구조가 있을지에 대해 생각해봐야하는데 보통 배열과 같은 간단한 자료구조를 가지는데 복잡한 트리 기반의 자료구조를 사용하기도 한다.
2. **Access method**: 프로세스가 호출하는 open(), read(), write() 등의 명령은 어떤 자료 구조와 관련이 있고 어떻게 동작하는지에 대해 알아야 한다.

# ◼︎ Overall organization

우선 disk를 **block**들로 나눠야 한다. 
<center><img src="/images/OS/fs_disk.png" width = "800"></center><br>

* Data region: 사용자 데이터가 있는 공간
* Inode: 각 파일에 대한 정보를 관리하는 metadata가 있는 곳, inode table 영역이다
* Allocation structure(Bitmap): inode, data를 저장할 수 있는지에 대한 여부를 알 수 있는 정보를 저장한다. inode bitmap과 data bitmap으로 이루어져있다.
* Super block: 시스템 전체에 대한 정보를 가지고 있다. 

# ◼︎ Inode
Inode는 index node의 줄임말이다. Inode table을 자세하게 그리면 다음과 같다.
<center><img src="/images/OS/fs_inode_table.png" width = "700"></center><br>
N번째의 inode를 읽고 싶으면 inode_start_address + N * sizeof(inode)를 하면 된다. 
<center><img src="/images/OS/fs_inode_simple.png" width = "700"></center><br>
size 60 위의 데이터에는 metadata들이 들어가있다. 보면 15개의 pointer밖에 못쓰고 있는것을 볼 수 있다. 하지만 이보다 더 큰 파일을 사용하기 때문에 다른 방법이 필요하다. 

## The multi level index
위에서 봤듯 direct block pointer만으로는 60KB보다 더 큰 파일을 처리할 수 없다. 그래서 indirect pointer 를 사용하게 된다. 하나의 inode에는 4KB 크기의 주소 블록이 있다. 주소 공간 하나를 4byte로 표현할 수 있으면 총 1024개의 디스크 주소를 가지게 된다. 그래서 4KBx1024=4MB의 파일을 나타낼 수 있게 된다. Double indirect를 하면 4KBx1024x1024=4GB 그리고 triple indirect를 사용하면 4KBx1024x1024x1024=4TB를 나타낼 수 있따. 이렇게 하면 시간은 더 오래 걸리겠지만 큰 파일을 처리할 수 있다. 

# ◼︎ Directory organization

vsfs의 디렉터리 구조는 간단하다. 다음 그림과 같다
<center><img src="/images/OS/fs_direct.png" width = "700"></center><br>
Inode 번호, 레코트 길이(이름에 사용된 총 바이트+남은 공간), 문자열 길이로 구성 되어 있다.

# ◼︎ Access Paths: Reading and Writing

파일을 어떻게 읽고 쓰는지에 대해 timeline을 그려 알아보려고 한다. 

## Reading a file from disk

/foo/bar이라는게 있다고 하자. 그리고 bar 파일은 3개의 disk block으로 구성되어 있다고 하자. 
<center><img src="/images/OS/fs_read.png" width = "700"></center><br>

## Writing a file from disk

<center><img src="/images/OS/fs_write.png" width = "700"></center><br>