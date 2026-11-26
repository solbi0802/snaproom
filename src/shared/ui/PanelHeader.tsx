import type { ReactNode } from 'react'
import styles from './PanelHeader.module.css'

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <div className={styles.header}><h2>{title}</h2>{children != null && <span>{children}</span>}</div>
}
