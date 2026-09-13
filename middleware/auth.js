function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.is_admin === 1) {
        return next();
    }
    res.status(403).render('frontend/error', { 
        title: '权限不足',
        message: '您没有权限访问此页面'
    });
}

function checkUserStatus(req, res, next) {
    if (req.session.user && req.session.user.status === 0) {
        req.session.destroy();
        return res.redirect('/login?msg=账号已被禁用');
    }
    if (req.session.user && req.session.user.status === -1) {
        req.session.destroy();
        return res.redirect('/login?msg=账号已被拉黑');
    }
    next();
}

module.exports = {
    isAuthenticated,
    isAdmin,
    checkUserStatus
};