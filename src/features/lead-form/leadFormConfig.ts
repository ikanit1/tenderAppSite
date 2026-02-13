import type { SelectOption } from '@/shared/ui/Select/Select';

export const projectTypeOptions: SelectOption[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Частный дом' },
  { value: 'office', label: 'Офис' },
  { value: 'commercial', label: 'Коммерческое помещение' },
  { value: 'other', label: 'Другое' },
];

export const defaultLeadFormFields = {
  name: { required: true, label: 'Имя' },
  phone: { required: true, label: 'Телефон' },
  email: { required: false, label: 'Email' },
  projectType: { required: false, label: 'Тип проекта', options: projectTypeOptions },
  message: { required: true, label: 'Сообщение', type: 'textarea' as const },
} as const;
