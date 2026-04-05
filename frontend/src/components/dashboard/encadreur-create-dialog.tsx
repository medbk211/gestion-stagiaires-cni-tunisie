import { useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ApiError, encadreursApi } from "@/api"

interface EncadreurCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const GRADES = [
  { value: "Junior", label: "Junior" },
  { value: "Senior", label: "Senior" },
  { value: "Expert", label: "Expert" },
]

const DEPARTEMENTS = [
  { value: "INFORMATIQUE", label: "Informatique" },
  { value: "RESSOURCES_HUMAINES", label: "Ressources Humaines" },
  { value: "FINANCES", label: "Finances" },
  { value: "EXPLOITATION", label: "Exploitation" },
  { value: "SUPPORT", label: "Support" },
  { value: "ADMINISTRATION", label: "Administration" },
]

const NO_DEPARTEMENT_VALUE = "__none__"

export function EncadreurCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: EncadreurCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    matricule: "",
    grade: "Junior",
    departement: "",
    actif_encadrement: true,
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      setIsSubmitting(true)
      setErrorMessage("")

      const accessToken = localStorage.getItem("cni_access_token")
      if (!accessToken) {
        setErrorMessage("Session expiree. Veuillez vous reconnecter.")
        return
      }

      // Validate required fields
      if (!formData.nom.trim() || !formData.prenom.trim() || !formData.email.trim() || !formData.matricule.trim()) {
        setErrorMessage("Tous les champs requis doivent etre remplis")
        return
      }

      const payload = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        matricule: formData.matricule,
        grade: formData.grade,
        departement: formData.departement || null,
        actif_encadrement: formData.actif_encadrement,
      }

      await encadreursApi.create(payload)

      setFormData({
        nom: "",
        prenom: "",
        email: "",
        matricule: "",
        grade: "Junior",
        departement: "",
        actif_encadrement: true,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message || "Erreur lors de la creation de l'encadreur")
      } else if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage("Erreur lors de la creation de l'encadreur")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter un nouvel encadreur</DialogTitle>
          <DialogDescription>
            Remplissez le formulaire pour creer un nouveau compte encadreur
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prenom">Prenom</Label>
              <Input
                id="prenom"
                placeholder="Prenom"
                value={formData.prenom}
                onChange={(e) => handleInputChange("prenom", e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                placeholder="Nom"
                value={formData.nom}
                onChange={(e) => handleInputChange("nom", e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <Label htmlFor="matricule">Matricule</Label>
            <Input
              id="matricule"
              placeholder="Matricule"
              value={formData.matricule}
              onChange={(e) => handleInputChange("matricule", e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Select value={formData.grade} onValueChange={(value) => handleInputChange("grade", value)}>
                <SelectTrigger id="grade" disabled={isSubmitting}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((grade) => (
                    <SelectItem key={grade.value} value={grade.value}>
                      {grade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="departement">Departement</Label>
              <Select
                value={formData.departement || NO_DEPARTEMENT_VALUE}
                onValueChange={(value) =>
                  handleInputChange(
                    "departement",
                    value === NO_DEPARTEMENT_VALUE ? "" : value,
                  )
                }
              >
                <SelectTrigger id="departement" disabled={isSubmitting}>
                  <SelectValue placeholder="Choisir un departement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTEMENT_VALUE}>Aucun</SelectItem>
                  {DEPARTEMENTS.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="actif_encadrement"
              checked={formData.actif_encadrement}
              onChange={(e) => handleInputChange("actif_encadrement", e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border border-input"
            />
            <Label htmlFor="actif_encadrement" className="font-normal cursor-pointer">
              Actif pour l'encadrement
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creation en cours..." : "Creer l'encadreur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
