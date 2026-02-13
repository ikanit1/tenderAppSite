import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/shared/ui/Input/Input';
import { Textarea } from '@/shared/ui/Textarea/Textarea';
import { Select, type SelectOption } from '@/shared/ui/Select/Select';
import { Button } from '@/shared/ui/Button/Button';
import { submitLead } from '@/mock/leadApi.mock';
import type { LeadFormData } from '@/entities/lead';
import { useToast } from '@/features/toast/ToastProvider';
import { projectTypeOptions } from './leadFormConfig';
import styles from './LeadForm.module.css';

const phoneRegex = /^[\d\s+()-]{10,20}$/;

interface LeadFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
  /** Скрыть поля (например только имя+телефон для быстрой заявки) */
  fields?: Partial<Record<keyof LeadFormData, boolean>>;
  /** Предзаполнение поля «Сообщение» (например, при переходе с карточки услуги) */
  defaultMessage?: string;
}

const defaultFields: Record<keyof LeadFormData, boolean> = {
  name: true,
  phone: true,
  email: true,
  projectType: true,
  message: true,
};

export function LeadForm({
  onSuccess,
  submitLabel = 'Отправить заявку',
  fields = defaultFields,
  defaultMessage = '',
}: LeadFormProps) {
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormData>({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      projectType: '',
      message: defaultMessage,
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    try {
      await submitLead(data);
      show('Заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.');
      onSuccess?.();
    } catch {
      show('Ошибка отправки. Попробуйте позже.', 'error');
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      {fields.name !== false && (
        <Input
          label="Имя *"
          error={errors.name?.message}
          {...register('name', { required: 'Обязательное поле' })}
        />
      )}
      {fields.phone !== false && (
        <Input
          label="Телефон *"
          type="tel"
          error={errors.phone?.message}
          {...register('phone', {
            required: 'Обязательное поле',
            pattern: {
              value: phoneRegex,
              message: 'Введите корректный номер',
            },
          })}
        />
      )}
      {fields.email !== false && (
        <Input
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email', {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Некорректный email',
            },
          })}
        />
      )}
      {fields.projectType !== false && (
        <Controller
          name="projectType"
          control={control}
          render={({ field }) => (
            <Select
              label="Тип проекта"
              placeholder="Выберите тип проекта"
              options={projectTypeOptions as SelectOption[]}
              error={errors.projectType?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      )}
      {fields.message !== false && (
        <Textarea
          label="Сообщение *"
          error={errors.message?.message}
          rows={4}
          {...register('message', { required: 'Обязательное поле' })}
        />
      )}
      <Button type="submit" variant="primary" disabled={isSubmitting} fullWidth>
        {isSubmitting ? 'Отправка…' : submitLabel}
      </Button>
    </form>
  );
}
