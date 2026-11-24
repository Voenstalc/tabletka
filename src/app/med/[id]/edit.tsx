import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { MedicationFormScreen } from '@/screens/MedicationForm';
import { useAppStore } from '@/store/appStore';

export default function EditMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const med = useAppStore((state) => state.meds.find((item) => item.id === id));

  if (!med) {
    return (
      <Screen
        edges={['top', 'bottom', 'left', 'right']}
        header={<Header title="Изменить лекарство" back />}
      >
        <EmptyState
          icon="alert-circle-outline"
          title="Лекарство не найдено"
          description="Возможно, оно было удалено."
          actionTitle="К списку лекарств"
          onAction={() => router.replace('/meds')}
        />
      </Screen>
    );
  }

  return <MedicationFormScreen existing={med} />;
}
