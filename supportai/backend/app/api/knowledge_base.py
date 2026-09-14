"""
Knowledge Base API.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from app.database.database import get_db
from app.models.knowledge_article import KnowledgeArticle
from app.models.user import User, UserRole
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])


class ArticleRequest(BaseModel):
    title: str
    category: str
    problem_description: str
    solution: str
    steps: Optional[str] = None
    keywords: Optional[str] = None


class ArticleResponse(BaseModel):
    id: int
    title: str
    category: str
    problem_description: str
    solution: str
    steps: Optional[str] = None
    keywords: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


@router.get("", response_model=List[ArticleResponse])
async def list_articles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.is_active == True)
    )
    articles = result.scalars().all()
    return [ArticleResponse.model_validate(a) for a in articles]


@router.post("", response_model=ArticleResponse, status_code=201)
async def create_article(
    request: ArticleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(status_code=403, detail="Access denied")

    article = KnowledgeArticle(
        title=request.title,
        category=request.category,
        problem_description=request.problem_description,
        solution=request.solution,
        steps=request.steps,
        keywords=request.keywords,
    )
    db.add(article)
    await db.flush()
    await db.refresh(article)
    return ArticleResponse.model_validate(article)


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    request: ArticleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.title = request.title
    article.category = request.category
    article.problem_description = request.problem_description
    article.solution = request.solution
    article.steps = request.steps
    article.keywords = request.keywords
    await db.flush()
    return ArticleResponse.model_validate(article)


@router.delete("/{article_id}")
async def delete_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.is_active = False
    await db.flush()
    return {"message": "Article deactivated"}
