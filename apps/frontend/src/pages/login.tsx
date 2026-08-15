import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, ApiError } from '@visit-control/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const loginSchema = z.object({
  login: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [, navigate] = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (result) => {
        login(result.token, result.user);
        navigate(result.user.mustChangePassword ? '/change-password' : result.user.role === 'attendant' ? '/service-center' : '/dashboard');
      },
      onError: (error: unknown) => {
        const apiError = error instanceof ApiError ? error : null;
        const apiMessage = apiError?.data && typeof apiError.data === 'object'
          ? (apiError.data as { error?: string }).error
          : undefined;
        const connectionFailed = !apiError;
        toast({
          variant: 'destructive',
          title: connectionFailed ? 'API indisponível' : 'Falha na autenticação',
          description: connectionFailed
            ? 'O frontend não conseguiu acessar o backend. Verifique a URL e se os serviços estão ativos.'
            : apiMessage ?? 'Usuário ou senha incorretos. Tente novamente.',
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[48%_52%]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#012c61] lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden="true">
          <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full border border-white" />
          <div className="absolute left-24 top-20 h-44 w-44 rotate-45 border border-white" />
          <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full border border-white" />
          <div className="absolute bottom-20 right-24 h-52 w-52 rotate-12 border border-white" />
        </div>

        <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-12 text-center">
          <img
            src="/logo-prefeitura.png"
            alt="Prefeitura de Paraíba do Sul"
            className="w-full max-w-[430px] object-contain drop-shadow-2xl"
          />
          <div className="mt-10 h-1 w-32 rounded-full bg-[#b2d233]" />
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/70">
            Gestão integrada, segura e eficiente para o atendimento aos visitantes.
          </p>
        </div>
      </section>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-10 sm:px-12">
        <div className="absolute left-0 top-0 h-1.5 w-full bg-[#b2d233] lg:hidden" />
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <div
              role="img"
              aria-label="Brasão da Prefeitura de Paraíba do Sul"
              className="mx-auto mb-5 h-24 w-24 bg-[#012c61]"
              style={{
                WebkitMaskImage: "url('/brasao.png')",
                maskImage: "url('/brasao.png')",
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
            <h1 className="text-3xl font-bold tracking-tight text-[#012c61]">
              Sistema de Controle
              <span className="block">de Visitantes</span>
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Entre com suas credenciais para acessar o sistema.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-sm space-y-5">
              <FormField
                control={form.control}
                name="login"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-[#012c61]">Login</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <UserRound className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#012c61]" />
                        <Input
                          placeholder="Digite seu login"
                          className="h-10 border-[#012c61]/35 bg-white pl-11 text-slate-900 shadow-sm focus-visible:border-[#012c61] focus-visible:ring-[#012c61]/25"
                          autoCapitalize="none"
                          autoComplete="username"
                          autoCorrect="off"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-[#012c61]">Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#012c61]" />
                        <Input
                          type="password"
                          placeholder="Digite sua senha"
                          className="h-10 border-[#012c61]/35 bg-white pl-11 text-slate-900 shadow-sm focus-visible:border-[#012c61] focus-visible:ring-[#012c61]/25"
                          autoComplete="current-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="relative h-10 w-full overflow-hidden border-0 bg-[#012c61] text-sm font-semibold text-white shadow-lg shadow-[#012c61]/20 hover:bg-[#01244f]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Autenticando...</>
                ) : 'Entrar'}
              </Button>
            </form>
          </Form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#012c61]" />
            Acesso restrito a funcionários autorizados
          </div>
        </div>
      </main>
    </div>
  );
}
