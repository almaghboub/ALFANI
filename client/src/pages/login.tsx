import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/queryClient";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import logoPath from "@assets/alfani-logo.png";
import { Lock, User } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      await login(data.username, data.password);
      
      try {
        const response = await apiRequest("GET", "/api/messages/unread-count");
        const unreadData = await response.json() as { count: number };
        
        if (unreadData.count > 0) {
          toast({
            title: t('loginSuccessful'),
            description: `${t('welcomeToLynx')} You have ${unreadData.count} unread message${unreadData.count > 1 ? 's' : ''}.`,
          });
        } else {
          toast({
            title: t('loginSuccessful'),
            description: t('welcomeToLynx'),
          });
        }
      } catch {
        toast({
          title: t('loginSuccessful'),
          description: t('welcomeToLynx'),
        });
      }
      
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: t('loginFailed'),
        description: t('invalidCredentials'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-background to-amber-50/30 dark:from-background dark:via-background dark:to-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoPath} alt="ALFANI Logo" className="h-28 w-auto mb-5" />
          <h1 className="text-3xl font-bold text-foreground tracking-tight">ALFANI</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1.5 font-medium">Auto Parts & Accessories</p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5">
          <CardContent className="p-7">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">{t('signIn')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t('logisticsManagementSystem')}</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('username')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                          <Input
                            placeholder={t('enterUsername')}
                            className="ltr:pl-10 rtl:pr-10 h-11 bg-muted/30 border-border/60 focus:bg-background transition-colors"
                            data-testid="input-username"
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
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('password')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                          <Input
                            type="password"
                            placeholder={t('enterPassword')}
                            className="ltr:pl-10 rtl:pr-10 h-11 bg-muted/30 border-border/60 focus:bg-background transition-colors"
                            data-testid="input-password"
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
                  className="w-full h-11 font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all duration-200 mt-2"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('signingIn')}
                    </div>
                  ) : t('signIn')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          ALFANI Management System v2.0
        </p>
      </div>
    </div>
  );
}
