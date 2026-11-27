import type { ComponentPropsWithRef, ReactNode } from 'react'
import styles from './Button.module.css'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'secondary', type = 'button', className, ...props }: ButtonProps) {
  return <button type={type} className={[styles.button, styles[variant], className].filter(Boolean).join(' ')} {...props} />
}

type IconButtonProps = Omit<ButtonProps, 'children' | 'aria-label'> & {
  label: string
  children: ReactNode
}

export function IconButton({ label, className, variant = 'ghost', ...props }: IconButtonProps) {
  return <Button {...props} variant={variant} aria-label={label} className={[styles.iconButton, className].filter(Boolean).join(' ')} />
}
