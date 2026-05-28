
import { useState } from "react"
import {
  Save,
  Bell,
  Shield,
  Globe,
  Building2,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)
  const { navItems, userName, userRole } = useAdminSidebar()

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6 max-w-3xl">
        <DashboardPageHeader
          title={"Param\u00e8tres"}
          subtitle="Configuration de la plateforme"
          actions={(
            <Button onClick={handleSave} className="gap-1.5 text-sm">
              <Save className="h-4 w-4" />
              {saved ? "Enregistre !" : "Enregistrer"}
            </Button>
          )}
        />

        {/* General */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{"G\u00e9n\u00e9ral"}</CardTitle>
            </div>
            <CardDescription>{"Informations de l\u2019organisme"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orgName" className="text-sm">{"Nom de l\u2019organisme"}</Label>
                <Input id="orgName" defaultValue="Organisation cliente" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orgAbbr" className="text-sm">{"Abr\u00e9viation"}</Label>
                <Input id="orgAbbr" defaultValue="STG" className="text-sm" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adminEmail" className="text-sm">Email administrateur</Label>
                <Input id="adminEmail" defaultValue="admin@entreprise.com" type="email" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adminTel" className="text-sm">{"T\u00e9l\u00e9phone"}</Label>
                <Input id="adminTel" defaultValue="+216 71 783 055" className="text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address" className="text-sm">Adresse</Label>
              <Input id="address" defaultValue="17, Rue Belhassan Ben Chaabane, 1005 El Omrane, Tunis" className="text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
            <CardDescription>{"G\u00e9rer les alertes et notifications"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[
              { id: "newCandidature", label: "Nouvelle candidature", desc: "Recevoir un email pour chaque nouvelle demande", defaultChecked: true },
              { id: "statusChange", label: "Changement de statut", desc: "Notifier lors des acceptations/refus", defaultChecked: true },
              { id: "stageEnd", label: "Fin de stage", desc: "Alerte 7 jours avant la fin d'un stage", defaultChecked: true },
              { id: "weeklyReport", label: "Rapport hebdomadaire", desc: "Recevoir un resume chaque lundi", defaultChecked: false },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch id={item.id} defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{"S\u00e9curit\u00e9"}</CardTitle>
            </div>
            <CardDescription>{"Param\u00e8tres de s\u00e9curit\u00e9 du compte"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPwd" className="text-sm">Mot de passe actuel</Label>
              <Input id="currentPwd" type="password" placeholder="********" className="text-sm max-w-sm" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPwd" className="text-sm">Nouveau mot de passe</Label>
                <Input id="newPwd" type="password" placeholder="********" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPwd" className="text-sm">Confirmer</Label>
                <Input id="confirmPwd" type="password" placeholder="********" className="text-sm" />
              </div>
            </div>
            <Button variant="outline" size="sm" className="self-start text-xs">
              Changer le mot de passe
            </Button>
          </CardContent>
        </Card>

        {/* Platform */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Plateforme</CardTitle>
            </div>
            <CardDescription>{"Configuration g\u00e9n\u00e9rale de la plateforme"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[
              { id: "candidaturesOpen", label: "Candidatures ouvertes", desc: "Autoriser la soumission de nouvelles candidatures", defaultChecked: true },
              { id: "autoAssign", label: "Affectation automatique", desc: "Affecter automatiquement un encadrant disponible", defaultChecked: false },
              { id: "maintenance", label: "Mode maintenance", desc: "Afficher un message de maintenance aux visiteurs", defaultChecked: false },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch id={item.id} defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
