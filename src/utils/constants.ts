export default class Constants {
    public static readonly EMAIL_VALIDATION_REGEX = /^[\w\.-]{1,63}@[a-z0-9\.-]{1,63}\.\w{2,4}$/i;
    public static readonly PASSWORD_VALIDATION_REGEX = /^.{6,}$/;
    public static readonly APPLICATION_NANO_ID_VALIDATION_REGEX = /^[\w\.-]{1,63}@[a-z\.-]{1,63}\.\w{2,4}$/i;
}
