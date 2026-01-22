def calculate_final_match(demande, projet):
    # شرط أساسي: المشروع متاح
    if projet.status.name != "DISPONIBLE":
        return None

    # شرط: نفس القسم
    if demande.departement_souhaite != projet.departement.value:
        return None

    # شرط: مدة الطلب تغطي مدة المشروع
    if getattr(demande, "date_debut_souhaitee", None) and getattr(demande, "date_fin_souhaitee", None):
        duree = (demande.date_fin_souhaitee - demande.date_debut_souhaitee).days // 7
        if duree < getattr(projet, "duree_semaines", 0):
            return None

    # اجمع البيانات أو خليها empty set
    demande_skills = set(getattr(demande, "competences", []) or [])
    required_skills = set(getattr(projet, "required_skills", []) or [])
    optional_skills = set(getattr(projet, "optional_skills", []) or [])

    score = 0

    # Required skills
    if required_skills:
        matched_required = len(required_skills & demande_skills)
        score += 5 * matched_required
        if matched_required == 0:
            score += 2  # score جزئي بدل reject

    # Optional skills
    if optional_skills:
        score += 3 * (len(demande_skills & optional_skills) / len(optional_skills))

    # Niveau etude match
    niveau_weights = {"PFE": 3, "PERFECTIONNEMENT": 2, "INITIATION": 1}
    if getattr(demande, "niveau_etude", None) == getattr(projet, "niveau_requis", None):
        score += niveau_weights.get(demande.niveau_etude, 0)

    # Ancienneté (max 3 semaines)
    anciennete_semaines = getattr(demande, "anciennete_jours", 0) // 7
    score += min(anciennete_semaines, 3)

    # Bonus durée الطلب تغطي مدة المشروع
    if getattr(demande, "date_debut_souhaitee", None) and getattr(demande, "date_fin_souhaitee", None):
        duree_demande = (demande.date_fin_souhaitee - demande.date_debut_souhaitee).days // 7
        if duree_demande >= getattr(projet, "duree_semaines", 0):
            score += 2

    return score
