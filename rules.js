// 졸업 요건(30기 한정): "30기 및 31기 대상 2022 교육과정 졸업 요건 안내" + 2026학년도 2학년(30기) 편제표 기준
// 학교 기준이 바뀌면 이 파일만 수정하면 됩니다.
window.RULES = {
  totalSubject: 174,          // 교과 최소 이수 학점
  totalAll: 192,              // 교과 + 창체
  creativeTotal: 18,
  creative: [                  // 창의적 체험활동 (학년별 편제표 학점)
    { year: 1, credit: 8 },
    { year: 2, credit: 6 },
    { year: 3, credit: 4 }
  ],
  // 교과(군)별 필수 이수 학점
  groups: [
    { key: '국어', label: '국어', min: 8 },
    { key: '수학', label: '수학', min: 8 },
    { key: '영어', label: '영어', min: 8 },
    { key: '사회', label: '사회(역사/도덕 포함)', min: 14 },
    { key: '과학', label: '과학', min: 10 },
    { key: '체육', label: '체육', min: 10 },
    { key: '예술', label: '예술(음악·미술)', min: 6 },
    { key: '기타', label: '기술·가정/정보/제2외국어/한문/교양', min: 12 }
  ],
  // 국·수·영 합계 상한: 81학점. 174학점 초과 시에는 초과분의 50%만큼만 상한이 늘어남(해석)
  kme: { cap: 81, keys: ['국어', '수학', '영어'], excessRatio: 0.5 },
  semMin: [30, 30, 29, 29, 28, 28]   // 학기별 최소 이수 학점 합계(편제표 각주 d)
};
