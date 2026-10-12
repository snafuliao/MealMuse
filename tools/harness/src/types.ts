/** 一条违规。message 说明问题，fix 告诉智能体具体怎么改（规则 §6.2：报错内嵌修复指令）。 */
export type Violation = {
  rule: string;
  file: string;
  line?: number;
  message: string;
  fix: string;
};

export type Rule = {
  id: string;
  description: string;
  run(root: string): Violation[];
};
