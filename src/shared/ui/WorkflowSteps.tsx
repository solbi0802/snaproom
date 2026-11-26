import styles from './WorkflowSteps.module.css'

const steps = [{ id: 'select', label: '사진 선택' }, { id: 'edit', label: '편집' }, { id: 'export', label: '저장' }] as const
type Step = typeof steps[number]['id']

export function WorkflowSteps({ current }: { current: Step }) {
  return <ol className={styles.steps} aria-label="사진 작업 순서">{steps.map((step, index) => <li key={step.id} aria-current={current === step.id ? 'step' : undefined}><span>{index + 1}</span>{step.label}</li>)}</ol>
}
