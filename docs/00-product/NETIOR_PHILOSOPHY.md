# Netior Philosophy

이 문서는 Netior의 현재 방향 전환을 하나의 앱 철학으로 정리한 초안이다.

## 핵심 문장

Netior는 World 안에 어떤 종류가 존재하고, 그들이 어떤 관계를 맺는지 정의한다.
그 정의를 실제 instance와 world의 변화에 할당한다.
Netior는 그 할당과 변화를 측정하고, 기록하고, 보여준다.

조금 더 풀어 쓰면 다음과 같다.

Netior는 사용자가 정의한 world의 종류와 관계를 기준으로, 외부와 내부의 instance 및 그 변화들을 관찰한다. 변화가 결정적으로 해석될 수 없는 지점에서는 AI와 협업해 판단하고, 그 판단과 결과를 구조화된 world 변화로 기록하며, 사용자가 탐색할 수 있는 형태로 보여준다.

## 사용자와 World

사용자는 world의 권위자다.

사용자는 그 세계가 무엇으로 이루어져 있는지, 어떻게 동작하는지, 어떻게 변화하는지를 정의할 수 있다. AI는 사용자의 세계를 원래부터 알 수 없다. 특히 소설, 연구, 작업 맥락, 개인 지식 체계처럼 사용자만이 알고 있는 world는 AI 모델의 지능과 별개로 비대칭적 정보를 가진다.

따라서 Netior에서 AI의 첫 번째 책임은 사용자의 세계관을 Netior의 언어로 번역하는 것이다. AI가 world를 창조하거나 확정하는 것이 아니라, 사용자가 가진 세계관을 명시적인 구조로 옮기는 일을 돕는다.

## Netior가 집중하는 것

Netior는 instance의 원본 내용과 생명주기를 강하게 소유하지 않는다.

현재 모델처럼 instance를 별도의 중심 모델로 두고 SQLite DB 안에 모두 저장하려 하면 외부와의 연동성이 떨어진다. Netior는 instance 자체의 내용보다 schema와 관계에 집중해야 한다. instance는 파일, 폴더, URL, 외부 서비스 객체, Netior-native resource 등 외부 또는 내부 source에 존재할 수 있다.

Netior가 소유해야 하는 핵심은 다음이다.

- World 안에 어떤 종류가 존재하는지
- 그 종류들이 어떤 속성과 관계를 가지는지
- 실제 instance가 어떤 종류에 할당되는지
- instance 사이에 어떤 관계가 할당되는지
- instance와 관계가 어떻게 변화하는지
- 그 변화가 어떤 근거와 판단을 통해 기록되었는지

Interactive view는 포기하지 않는다. 다만 interactive view는 Netior의 최상위 철학 그 자체가 아니라, `.md`, `.png`, `.pdf`, `.svc` 같은 instance 종류 중 Netior가 직접적으로 다루는 native resource 종류 중 하나다.

## Tree를 넘어서는 이유

Netior가 network에서 출발한 이유는 tree 구조의 한계 때문이다.

컴퓨터가 자료를 저장하는 방식과 사람이 개념을 저장하는 방식은 다르다. 예를 들어 "철수의 전화번호"를 찾을 때 사람은 전화번호부 폴더를 grep하고 파일명을 모두 뒤지는 방식으로 사고하지 않는다. 사람은 개념과 관계를 통해 곧장 접근한다.

따라서 network의 철학은 여전히 중요하다. 다만 canvas 자체가 엔진은 아니다. Netior의 엔진은 world의 종류와 관계를 정의하고, 그것을 실제 instance와 변화에 할당하며, 그 결과를 측정하고 기록하고 보여주는 데 있어야 한다.

## 세 가지 언어

Netior는 세 가지 언어를 가져야 한다.

첫째, 세상을 기술하는 언어가 필요하다.

이 언어는 world 안에 어떤 종류가 존재하는지, 그들이 어떤 속성과 관계를 가지는지를 표현한다. Schema와 relation을 만들 수 있어야 한다.

둘째, 세상을 동작시키는 언어가 필요하다.

세계가 동작한다는 것은 세계가 변화한다는 뜻이다. 이 변화는 이미 할당된 instance에만 국한되지 않는다. 새 파일, 새 객체, 바뀐 내용, 삭제된 resource, 아직 어떤 종류에도 할당되지 않은 instance 후보도 world 변화의 일부다.

Netior는 schema와 관계를 가지고 instance를 찾고, 읽고, 수정하고, 할당하고, 관계를 만들 수 있어야 한다.

셋째, 세상을 예측하고 검증하는 언어가 필요하다.

Validator는 아무 데이터 없이 맨땅에서 검증하지 않는다. Netior는 동작들을 로깅하고, 변화와 판단을 축적하고, 그 패턴을 분석해서 할당된 관계들이 적합한지 분별할 수 있어야 한다. Validator는 이 축적된 동작 데이터와 변화 데이터를 기반으로 world 정의를 검증한다.

## 변화의 측정과 해석

세계의 변화는 결정적으로 해석될 수 없다.

파일이 생겼다는 사실, 내용이 바뀌었다는 사실, 외부 서비스 객체가 업데이트되었다는 사실은 측정할 수 있다. 그러나 그 변화가 새로운 등장인물의 추가인지, 기존 플롯의 수정인지, 임시 파일인지, 무시해야 하는 변화인지는 결정적으로 알 수 없다.

그래서 Netior와 AI는 협업해야 한다.

Netior는 다음을 담당한다.

- 변화를 측정한다.
- 변화를 축적한다.
- 어떤 변화가 AI 해석을 필요로 하는지 판단한다.
- AI가 어떤 기준과 맥락으로 판단해야 하는지 정의한다.
- AI의 판단을 기록 가능한 형태로 받는다.
- AI의 판단을 world 변화 후보로 저장한다.
- 사용자 승인, 수정, 거절을 통해 확정된 world 변화로 반영한다.
- 이 모든 기록을 Validator가 분석할 수 있게 남긴다.

AI의 판단은 곧바로 world의 진실이 아니다. AI의 판단은 근거와 함께 기록되는 후보이며, 사용자의 결정 또는 명시된 정책을 통해서만 확정된다.

## View의 책임

Netior는 새로운 유형의 파일 탐색기 GUI를 설계해야 한다.

Windows 파일 탐색기가 컴퓨터의 어떤 위치에 어떤 파일과 폴더가 저장되어 있는지를 보여준다면, Netior는 world 안에 어떤 종류와 관계가 존재하고, 그것들이 어떤 instance와 변화에 할당되어 있는지를 보여줘야 한다.

따라서 Netior가 보여주는 것은 파일의 위치 자체가 아니라 의미의 구조와 그 변화다.

View는 크게 두 축을 가져야 한다.

첫째, 정적인 세계를 보여준다.

정적인 세계는 현재 world가 무엇으로 이루어져 있다고 정의되어 있는지를 보여준다. 여기에는 kind, schema, property, relation, instance assignment, 확정된 relation, 근거, 아직 할당되지 않았거나 애매한 instance 후보가 포함된다.

이 view는 다음 질문에 답해야 한다.

- 이 world에는 어떤 종류가 있는가?
- 각 종류는 어떤 속성과 관계를 가지는가?
- 이 instance는 무엇으로 해석되어 있는가?
- 이 instance는 무엇과 연결되어 있는가?
- 이 관계는 어떤 근거로 존재하는가?
- 아직 해석되지 않은 것은 무엇인가?

둘째, 세계의 evolution을 보여준다.

세계의 evolution은 world가 어떻게 변화해 왔고, 지금 어떤 변화가 해석을 기다리고 있는지를 보여준다. 여기에는 새로 감지된 resource, 변경된 resource, 사라진 resource, assignment 후보, relation 후보, AI 판단, 사용자 승인과 거절, Actor의 동작 로그, 반복 패턴, Validator가 발견한 충돌이 포함된다.

이 view는 다음 질문에 답해야 한다.

- 무엇이 새로 생겼는가?
- 무엇이 바뀌었는가?
- 그 변화는 어떻게 해석되었는가?
- AI는 어떤 근거로 판단했는가?
- 사용자는 무엇을 승인, 수정, 거절했는가?
- 이 world 정의는 실제 변화와 잘 맞고 있는가?

Network의 철학은 유지되어야 한다. 그러나 instance의 소유권을 내려놓은 만큼 network engine도 단순해져야 한다.

Network는 모든 instance를 소유하는 canvas DB가 아니라, world의 특정 관점을 보여주는 projection이어야 한다. View는 kind, relation, instance assignment, change event 중 무엇을 어떤 범위와 기준으로 보여줄지를 정의하고, layout은 사용자가 직접 배치하거나 접고 펼치고 강조한 상태만 가볍게 보존한다.

즉 Netior의 view는 위치 기반 파일 탐색기가 아니라 의미 기반 world 탐색기다. 위치가 아니라 의미를, 폴더가 아니라 kind를, 파일명만이 아니라 assignment를, 수정일만이 아니라 world evolution을 보여준다.

## AI Agent의 세 책임

Netior의 AI agent는 세 가지 메타적 책임으로 나뉜다.

### 1. Translator

Translator는 사용자의 세계관을 Netior의 언어로 번역한다.

사용자의 설명, 문서, 예시, 대화에서 kind, schema, property, relation, rule 후보를 만든다. Translator는 질문하고, 모호성을 드러내고, 구조를 제안할 수 있다. 그러나 Translator는 world 안에서 행동하지 않는다.

### 2. Actor

Actor는 사용자가 설정한 world 위에서 수행한다.

Actor는 확정된 schema와 relation을 기준으로 instance를 찾고, 읽고, 수정하고, 새 instance를 감지하고, 관계를 적용하고, 필요한 작업을 실행한다. Actor는 world를 변화시키는 동작을 수행할 수 있지만, ontology 자체를 마음대로 바꾸지 않는다.

### 3. Validator

Validator는 사용자가 설정한 world를 검증한다.

Validator는 Actor의 동작 로그, 변화 기록, AI 판단, 사용자 승인과 거절, 반복 패턴을 분석한다. 이를 바탕으로 현재 schema와 relation이 실제 world 변화에 적합한지 검증한다. Validator는 수정안을 제안할 수 있지만, 직접 world 정의를 확정하지 않는다.

이 세 책임은 완벽하게 격리되어야 한다.

- Translator는 행동하지 않는다.
- Actor는 ontology를 임의로 바꾸지 않는다.
- Validator는 행동하거나 확정하지 않는다.

## 통합된 책임

Netior의 책임은 단순히 정적인 ontology를 편집하는 것이 아니다.

Netior는 사용자가 정의한 world의 언어를 가지고, 실제 instance와 변화하는 환경에 그 언어를 적용한다. 할당된 instance뿐 아니라 아직 할당되지 않은 새 instance와 resource 변화도 관찰 대상이다. Netior는 결정 가능한 변화는 측정하고, 결정 불가능한 의미 해석은 AI와 협업하며, 그 해석의 조건과 결과와 책임 경계를 기록한다.

결국 Netior는 다음을 수행하는 AI-native ontology workspace다.

- 세상을 정의한다.
- 정의를 instance와 변화에 할당한다.
- 변화를 측정한다.
- AI 해석을 통제 가능한 기록으로 만든다.
- 사용자가 승인한 결과를 world 변화로 반영한다.
- 동작과 변화의 축적을 기반으로 world 정의를 검증한다.
- 그 모든 구조를 사용자가 탐색할 수 있게 보여준다.
