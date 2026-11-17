from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config

db=SQLAlchemy()
jwt=JWTManager()

class User(db.Model):
    id=db.Column(db.Integer,primary_key=True)
    first=db.Column(db.String(80),nullable=False)
    last=db.Column(db.String(80),nullable=False)
    password=db.Column(db.String(255),nullable=False)

class Progress(db.Model):
    id=db.Column(db.Integer,primary_key=True)
    user_id=db.Column(db.Integer,db.ForeignKey("user.id"),nullable=False)
    topic=db.Column(db.String(80),nullable=False)
    data=db.Column(db.JSON,default=dict)
    __table_args__=(db.UniqueConstraint("user_id","topic"),)

def create_app():
    app=Flask(__name__); app.config.from_object(Config)
    db.init_app(app); jwt.init_app(app)
    CORS(app,resources={r"/api/*":{"origins":app.config["FRONTEND_ORIGIN"]}})
    with app.app_context():db.create_all()

    admin = User.query.filter_by(first="admin", last="admin").first()

    if not admin:
            admin = User(
                first="admin",
                last="admin",
                password=generate_password_hash("123456")
            )
            db.session.add(admin)
            db.session.commit()
    @app.get("/api/health")
    def health(): return {"ok":True}
    @app.post("/api/auth/<mode>")
    def auth(mode):
        d=request.get_json() or {}; first=(d.get("firstName") or "").strip(); last=(d.get("lastName") or "").strip(); pw=d.get("password") or ""
        if not first or not last or len(pw)<6: return jsonify(message="Ism, familiya va kamida 6 belgili parol kerak."),400
        u=User.query.filter_by(first=first,last=last).first()
        if mode=="register":
            if u: return jsonify(message="Bu ism-familiya bilan hisob mavjud. Kirish bo‘limidan foydalan."),409
            u=User(first=first,last=last,password=generate_password_hash(pw)); db.session.add(u); db.session.commit()
        elif mode=="login":
            if not u or not check_password_hash(u.password,pw): return jsonify(message="Kirish ma’lumotlari noto‘g‘ri."),401
        else: return jsonify(message="Noto‘g‘ri amal."),404
        return jsonify(token=create_access_token(identity=str(u.id)),user={"id":u.id,"firstName":u.first,"lastName":u.last})
    @app.get("/api/me")
    @jwt_required()
    def me():
        u=db.session.get(User,int(get_jwt_identity()))
        return jsonify(user={"id":u.id,"firstName":u.first,"lastName":u.last})
    @app.get("/api/progress")
    @jwt_required()
    def get_progress():
        rows=Progress.query.filter_by(user_id=int(get_jwt_identity())).all()
        return jsonify({r.topic:r.data for r in rows})
    @app.post("/api/progress/<topic>")
    @jwt_required()
    def save_progress(topic):
        uid=int(get_jwt_identity()); row=Progress.query.filter_by(user_id=uid,topic=topic).first()
        if not row: row=Progress(user_id=uid,topic=topic,data={}); db.session.add(row)
        row.data={**(row.data or {}),**(request.get_json() or {})}; db.session.commit()
        return jsonify(row.data)
    return app

app=create_app()
if __name__=="__main__": app.run(debug=True,port=5000)
