const TEMPLATES: Record<string, { subject: string; body: string }> = {
  "design.published": {
    subject: "디자인이 공개되었습니다",
    body: "프로젝트 디자인이 공개되었습니다. {{url}}",
  },
  "design.approval_requested": {
    subject: "디자인 승인이 필요합니다",
    body: "공개된 디자인을 확인하고 승인하거나 반려해 주세요. {{url}}",
  },
  "design.approved": {
    subject: "디자인이 승인되었습니다",
    body: "고객이 디자인을 승인했습니다. {{url}}",
  },
  "design.rejected": {
    subject: "디자인이 반려되었습니다",
    body: "고객이 디자인을 반려했습니다. {{url}}",
  },
  "material.approval_requested": {
    subject: "자재 승인이 필요합니다",
    body: "공개된 자재를 확인하고 승인하거나 반려해 주세요. {{url}}",
  },
  "material.approved": {
    subject: "자재가 승인되었습니다",
    body: "고객이 자재를 승인했습니다. {{url}}",
  },
  "comment.created": {
    subject: "새 댓글이 있습니다",
    body: "프로젝트에 새 댓글이 등록되었습니다. {{url}}",
  },
  "comment.binding_created": {
    subject: "확정 지시가 등록되었습니다",
    body: "고객이 확정 지시를 남겼습니다. {{url}}",
  },
  "schedule.published": {
    subject: "일정이 공개되었습니다",
    body: "프로젝트 일정이 공개되었습니다. {{url}}",
  },
  "schedule.changed": {
    subject: "일정이 변경되었습니다",
    body: "프로젝트 일정이 변경되었습니다. {{url}}",
  },
  "photo.published": {
    subject: "진행 사진이 공개되었습니다",
    body: "현장 사진이 공개되었습니다. {{url}}",
  },
  "project.created": {
    subject: "프로젝트가 생성되었습니다",
    body: "새 프로젝트가 생성되었습니다. {{url}}",
  },
  "project.access_granted": {
    subject: "프로젝트에 초대되었습니다",
    body: "프로젝트에 접근할 수 있습니다. {{url}}",
  },
  "verification.code_issued": {
    subject: "확정 코드가 발급되었습니다",
    body: "확정 코드를 발급했습니다. 고객에게 전달했는지 확인해 주세요.",
  },
  "template.promotion_requested": {
    subject: "공통 템플릿 제안이 있습니다",
    body: "프로젝트 템플릿 승격 요청이 있습니다. {{name}}",
  },
  "company.status_changed": {
    subject: "업체 상태가 변경되었습니다",
    body: "업체 상태가 {{status}} 로 변경되었습니다.",
  },
  "assignment.changed": {
    subject: "현장 배정이 변경되었습니다",
    body: "프로젝트 배정이 변경되었습니다. {{url}}",
  },
  "request.created": {
    subject: "고객 요청이 등록되었습니다",
    body: "새 고객 요청이 있습니다. {{url}}",
  },
  "estimate.published": {
    subject: "견적서가 공개되었습니다",
    body: "견적서를 확인할 수 있습니다. {{url}}",
  },
  "meeting.published": {
    subject: "미팅 기록이 공개되었습니다",
    body: "미팅·협의 기록을 확인할 수 있습니다. {{url}}",
  },
};

export function renderTemplate(
  eventType: string,
  variables: Record<string, string>,
) {
  const tpl = TEMPLATES[eventType] ?? {
    subject: eventType,
    body: "{{url}}",
  };
  const fill = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? "");
  return { subject: fill(tpl.subject), body: fill(tpl.body) };
}
