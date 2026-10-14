import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useLang } from '../lib/i18n'
import { FieldError } from '../components/common/ui'

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.')
})

export default function Login() {
  const { login } = useAuth()
  const { t } = useLang()
  const nav = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      const { data } = await api.post('/auth/login', v)
      login(data.access_token, data.user)
      toast.success(`Welcome back, ${data.user.full_name.split(' ')[0]}!`)
      nav(data.user.role === 'seller' ? '/seller' : data.user.role === 'admin' ? '/admin' : '/market')
    } catch (e: any) { toast.error(apiError(e)) }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold text-forest">{t('auth.login.title')}</h1>
      <p className="text-muted text-sm mt-1">New to FarmLink? Create a buyer or seller account in a minute.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 mt-5 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">{t('form.email')}</label>
          <input id="email" className="input" type="email" autoComplete="email" {...register('email')} />
          <FieldError msg={errors.email?.message} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('form.password')}</label>
          <input id="password" className="input" type="password" autoComplete="current-password" {...register('password')} />
          <FieldError msg={errors.password?.message} />
        </div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Log in'}</button>
        <p className="text-sm text-center text-muted">New here? <Link to="/register" className="text-farm font-semibold">Create an account</Link></p>
      </form>
    </div>
  )
}
