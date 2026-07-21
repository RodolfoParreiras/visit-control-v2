import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { KeyRound, Loader2 } from 'lucide-react';
import { changePassword } from '@visit-control/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function ChangePassword() {
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Senha muito curta', description: 'Use ao menos 8 caracteres.' });
      return;
    }

    if (newPassword !== confirmation) {
      toast({ variant: 'destructive', title: 'As senhas não conferem' });
      return;
    }

    setIsSaving(true);
    try {
      const user = await changePassword({ currentPassword, newPassword });
      updateUser(user);
      toast({ title: 'Senha alterada com sucesso' });
      navigate('/dashboard');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível alterar a senha',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-2xl font-bold">Defina sua nova senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Por segurança, altere a senha provisória antes de acessar o sistema.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Senha atual</label>
            <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nova senha</label>
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirme a nova senha</label>
            <Input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} />
          </div>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Alterar senha e continuar
          </Button>
        </div>
      </form>
    </main>
  );
}
