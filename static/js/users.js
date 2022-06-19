var userRefreshTimeout = null
var lastUserDataHash = null

function refreshUsers() {
    clearTimeout(userRefreshTimeout)
    $.getJSON(`/api/rooms/${room}/users`)
        .done(data => {
            // only update if changed
            hash = base64(JSON.stringify(data))
            if (hash != lastUserDataHash) {
                fillPrototype(data, ".user", ".users")
            }
            lastUserDataHash = hash
            userRefreshTimeout = setTimeout(refreshUsers, 5000)
        })
        .fail(error => {
            console.error(error)
        })
}

$(function () {
    // check for new users every second
    refreshUsers()
})