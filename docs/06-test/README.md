# Test

Test 문서는 Netior의 테스트 전략, 검증 시나리오, QA checklist를 정리하는 공간이다.

이 폴더는 아직 구체적인 테스트 계획이 확정되지 않았으므로, 당분간 검증 기준과 시나리오를 모으는 장소로 둔다.

## Writing Rule

- 제품 방향과 도메인 모델의 핵심 가정이 실제 사용 흐름에서 검증되는지 확인한다.
- 단순 snapshot보다 사용자가 World를 정의하고, resource에 할당하고, 변화를 확인하는 흐름을 우선한다.
- AI 제안은 accepted/rejected/superseded 흐름까지 검증한다.
- 미확정 설계는 테스트 기준으로 고정하지 않는다.
