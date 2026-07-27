import { redirect } from "next/navigation";

// Ancienne page « comptes » restée à l'état de stub « bientôt disponible ».
// La gestion des comptes vit dans /dashboard/challenge (la synchro broker,
// elle, est dans /dashboard/settings) : on redirige pour ne plus afficher un
// faux « prochainement » aux utilisateurs qui gardent le lien en favori.
export default function AccountsPage() {
  redirect("/dashboard/challenge");
}
