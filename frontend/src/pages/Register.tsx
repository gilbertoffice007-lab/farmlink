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
  full_name: z.string().min(2, 'Please enter your name.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  role: z.enum(['buyer', 'seller']),
  phone: z.string().optional()
})

export default function Register() {
  const { login } = useAuth()
  const { t } = useLang()
  const nav = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { role: 'buyer' }
  })

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      const { data } = await api.post('/auth/register', v)
      login(data.access_token, data.user)
      toast.success('Account created!')
      nav(data.user.role === 'seller' ? '/onboarding' : '/market')
    } catch (e: any) { toast.error(apiError(e)) }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold text-forest">{t('auth.register.title')}</h1>
      <p className="text-muted text-sm mt-1">One account, one counter: <b>buyers shop</b>, <b>sellers sell</b>. Admin accounts are never created here.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 mt-5 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="name">{t('form.name')}</label>
          <input id="name" className="input" autoComplete="name" {...register('full_name')} />
          <FieldError msg={errors.full_name?.message} />
        </div>
        <div>
          <label className="label" htmlFor="email">{t('form.email')}</label>
          <input id="email" className="input" type="email" autoComplete="email" {...register('email')} />
          <FieldError msg={errors.email?.message} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('form.password')}</label>
          <input id="password" className="input" type="password" autoComplete="new-password" {...register('password')} />
          <FieldError msg={errors.password?.message} />
        </div>
        <fieldset>
          <legend className="label">{t('form.role')}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            <label className="card p-3 text-sm font-semibold cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20">
              <input type="radio" value="buyer" {...register('role')} className="mr-2 accent-[#28784A]" /> {t('role.buyer')}
            </label>
            <label className="card p-3 text-sm font-semibold cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20">
              <input type="radio" value="seller" {...register('role')} className="mr-2 accent-[#28784A]" /> {t('role.seller')}
            </label>
          </div>
        </fieldset>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create account'}</button>
        <p className="text-sm text-center text-muted">Have an account? <Link to="/login" className="text-farm font-semibold">Log in</Link></p>
      </form>
    </div>
  )
}
