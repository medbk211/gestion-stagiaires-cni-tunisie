from __future__ import annotations

from datetime import date
from typing import Iterable


def _enum_value(value: object) -> object:
    return value.value if hasattr(value, 'value') else value


def _normalize_token(value: object) -> str:
    if value is None:
        return ''
    return str(_enum_value(value)).strip().lower()


def _as_token_set(values: Iterable[object] | None) -> set[str]:
    if not values:
        return set()
    normalized = set()
    for value in values:
        token = _normalize_token(value)
        if token:
            normalized.add(token)
    return normalized


def _weeks_between(start_date, end_date) -> int | None:
    if not start_date or not end_date:
        return None
    delta_days = (end_date - start_date).days
    if delta_days <= 0:
        return 0
    weeks = delta_days // 7
    return max(1, weeks)


def _jaccard_similarity(left: set[str], right: set[str]) -> float:
    if not left and not right:
        return 0.0
    union = left | right
    if not union:
        return 0.0
    return len(left & right) / len(union)


def calculate_final_match(demande, projet):
    """
    Compute a compatibility score between a demand and a project.

    Returns:
    - float score (higher is better)
    - None if the project is not eligible for this demand
    """
    project_status = _normalize_token(getattr(projet, 'status', None))
    if project_status != 'disponible':
        return None

    demande_departement = _normalize_token(getattr(demande, 'departement_souhaite', None))
    projet_departement = _normalize_token(getattr(projet, 'departement', None))
    if demande_departement != projet_departement:
        return None

    demande_duration_weeks = _weeks_between(
        getattr(demande, 'date_debut_souhaitee', None),
        getattr(demande, 'date_fin_souhaitee', None),
    )
    projet_duration_weeks = int(getattr(projet, 'duree_semaines', 0) or 0)

    # Hard guard: reject if demand duration is clearly too short.
    if (
        demande_duration_weeks is not None
        and projet_duration_weeks > 0
        and demande_duration_weeks < max(2, int(round(projet_duration_weeks * 0.6)))
    ):
        return None

    score = 0.0

    demande_skills = _as_token_set(getattr(demande, 'competences', None))
    projet_skills = _as_token_set(getattr(projet, 'competences', None))
    if projet_skills:
        skills_coverage = len(demande_skills & projet_skills) / len(projet_skills)
        score += 45.0 * skills_coverage

    demande_tags = _as_token_set(getattr(demande, 'tags', None))
    projet_tags = _as_token_set(getattr(projet, 'tags', None))
    score += 15.0 * _jaccard_similarity(demande_tags, projet_tags)

    demande_type_stage = _normalize_token(getattr(demande, 'niveau_etude', None))
    projet_type_stage = _normalize_token(getattr(projet, 'type_stage', None))
    if demande_type_stage and projet_type_stage:
        if demande_type_stage == projet_type_stage:
            score += 20.0
        else:
            score -= 8.0

    if demande_duration_weeks is not None and projet_duration_weeks > 0:
        duration_fit = min(demande_duration_weeks, projet_duration_weeks) / max(
            demande_duration_weeks,
            projet_duration_weeks,
        )
        score += 15.0 * duration_fit
        if demande_duration_weeks >= projet_duration_weeks:
            score += 5.0

    created_at = getattr(demande, 'created_at', None)
    if created_at and hasattr(created_at, 'date'):
        waiting_days = max(0, (date.today() - created_at.date()).days)
        score += min(waiting_days / 14.0, 5.0)

    return round(max(score, 0.0), 2)
